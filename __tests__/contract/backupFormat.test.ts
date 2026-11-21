/**
 * The encrypted backup format (docs/BACKUP_FORMAT.md, plan P10), pinned in
 * contracts/backup-format.json. The Kotlin (BackupFormatTest.kt) and Swift
 * (ios/ZeroBackup/Tests) implementations open every case and refuse every
 * reject with the same answer. Node's crypto writes the file, so a phone's
 * file and the reference agree byte for byte where they can (key, header),
 * and through a round trip where they cannot (DEFLATE output may differ by
 * implementation; any valid stream must open).
 *
 * After a deliberate change: ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/contract/backupFormat.test.ts
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';
import {HEADER_BYTES, deriveKey, open, seal} from '../harness/backupFormatReference';

const FILE = fromRoot('contracts', 'backup-format.json');

/** A backup-shaped JSON long enough to need several DEFLATE blocks. */
const longJson = (): string =>
  JSON.stringify({
    key: 'zeroAbCdEfGhIjKlMnOp',
    version: 6,
    data: {
      expenses: Array.from({length: 400}, (_, i) => ({
        title: `Entry ${i} ₹ café 😀`,
        amount: (i * 37) % 9001,
        date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T09:00:00`,
      })),
    },
  });

interface CaseSpec {
  name: string;
  /** What the writer typed. */
  passphrase: string;
  /** What the reader types: the same words, perhaps encoded differently. */
  openWith: string;
  saltHex: string;
  nonceHex: string;
  iterations: number;
  writtenAtMs: number;
  plaintext: string;
}

const SPECS: CaseSpec[] = [
  {
    name: 'small',
    passphrase: 'correct horse battery staple',
    openWith: 'correct horse battery staple',
    saltHex: '000102030405060708090a0b0c0d0e0f',
    nonceHex: 'a0a1a2a3a4a5a6a7a8a9aaab',
    iterations: 1_000,
    writtenAtMs: 1_794_412_800_000,
    plaintext: '{"key":"zeroAbCdEfGhIjKlMnOp","version":6,"data":{"users":[{"username":"Asha ₹","email":""}]}}',
  },
  {
    name: 'production iterations',
    passphrase: 'zero-backup-test',
    openWith: 'zero-backup-test',
    saltHex: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
    nonceHex: '0c0b0a090807060504030201',
    iterations: 600_000,
    writtenAtMs: 1_794_499_200_123,
    plaintext: '{}',
  },
  {
    // "é" typed as e + combining accent by one keyboard and as one character by another.
    name: 'passphrase normalised to NFC',
    passphrase: 'café ☕ पासवर्ड',
    openWith: 'café ☕ पासवर्ड',
    saltHex: '11111111111111111111111111111111',
    nonceHex: '222222222222222222222222',
    iterations: 1_000,
    writtenAtMs: 0,
    plaintext: '{"note":"nfc"}',
  },
  {
    name: 'long backup',
    passphrase: 'long one',
    openWith: 'long one',
    saltHex: '5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a',
    nonceHex: '313233343536373839303132',
    iterations: 1_000,
    writtenAtMs: 1_794_412_800_000,
    plaintext: longJson(),
  },
];

const hex = (value: string) => Buffer.from(value, 'hex');

const built = SPECS.map(spec => {
  const file = seal(
    spec.plaintext,
    spec.passphrase,
    hex(spec.saltHex),
    spec.iterations,
    spec.writtenAtMs,
    hex(spec.nonceHex),
  );
  return {
    ...spec,
    keyHex: deriveKey(spec.passphrase, hex(spec.saltHex), spec.iterations).toString('hex'),
    headerHex: file.subarray(0, HEADER_BYTES).toString('hex'),
    fileBase64: file.toString('base64'),
  };
});

const small = Buffer.from(built[0]?.fileBase64 ?? '', 'base64');
const changed = (at: number, value: number): Buffer => {
  const copy = Buffer.from(small);
  copy[at] = value;
  return copy;
};
const REJECTS = [
  {
    name: 'shorter than a header and a tag',
    file: small.subarray(0, 60),
    passphrase: 'correct horse battery staple',
    error: 'notBackup',
  },
  {name: 'not the magic', file: changed(0, 0x7a), passphrase: 'correct horse battery staple', error: 'notBackup'},
  {
    name: 'a newer format version',
    file: changed(7, 2),
    passphrase: 'correct horse battery staple',
    error: 'newerFormat',
  },
  {
    name: 'an unknown key derivation',
    file: changed(8, 2),
    passphrase: 'correct horse battery staple',
    error: 'newerFormat',
  },
  {
    name: 'an unknown compression',
    file: changed(29, 2),
    passphrase: 'correct horse battery staple',
    error: 'newerFormat',
  },
  {
    name: 'iterations past the limit',
    file: (() => {
      const copy = Buffer.from(small);
      copy.writeUInt32BE(20_000_000, 9);
      return copy;
    })(),
    passphrase: 'correct horse battery staple',
    error: 'notBackup',
  },
  {name: 'the wrong passphrase', file: small, passphrase: 'correct horse battery stapler', error: 'wrongPassphrase'},
  {
    name: 'a changed header (the written-at time)',
    file: changed(37, ((small[37] ?? 0) + 1) % 256),
    passphrase: 'correct horse battery staple',
    error: 'wrongPassphrase',
  },
  {
    name: 'a changed ciphertext',
    file: changed(HEADER_BYTES + 2, ((small[HEADER_BYTES + 2] ?? 0) + 1) % 256),
    passphrase: 'correct horse battery staple',
    error: 'wrongPassphrase',
  },
].map(reject => ({
  name: reject.name,
  passphrase: reject.passphrase,
  error: reject.error,
  fileBase64: reject.file.toString('base64'),
}));

describe('the reference implementation', () => {
  it.each(built)('$name opens with the reader’s passphrase', item => {
    expect(open(Buffer.from(item.fileBase64, 'base64'), item.openWith)).toEqual({ok: true, text: item.plaintext});
  });

  it.each(REJECTS)('refuses $name as $error', reject => {
    expect(open(Buffer.from(reject.fileBase64, 'base64'), reject.passphrase)).toEqual({ok: false, error: reject.error});
  });

  it('compresses: a long backup is far smaller than its JSON', () => {
    const long = built.find(item => item.name === 'long backup');
    expect(Buffer.from(long?.fileBase64 ?? '', 'base64').length).toBeLessThan((long?.plaintext.length ?? 0) / 4);
  });
});

it('pins every case for the Kotlin and Swift implementations (contracts/backup-format.json)', () => {
  const json = `${JSON.stringify({formatVersion: 1, cases: built, rejects: REJECTS}, null, 2)}\n`;
  if (process.env['ZERO_UPDATE_CONTRACTS'] === '1') {
    fs.writeFileSync(FILE, json);
  }
  expect(fs.readFileSync(FILE, 'utf8')).toBe(json);
});
