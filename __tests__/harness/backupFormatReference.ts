/**
 * The encrypted backup format (docs/BACKUP_FORMAT.md) written with Node's own
 * crypto and zlib: the reference that writes contracts/backup-format.json, which
 * the Kotlin and Swift implementations are tested against. Test-only: the app
 * never encrypts in JS.
 */
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const MAGIC = Buffer.from('ZEROBAK', 'ascii');
export const HEADER_BYTES = 50;
const TAG_BYTES = 16;

export const deriveKey = (passphrase: string, salt: Buffer, iterations: number): Buffer =>
  crypto.pbkdf2Sync(Buffer.from(passphrase.normalize('NFC'), 'utf8'), salt, iterations, 32, 'sha256');

const header = (salt: Buffer, iterations: number, writtenAtMs: number, nonce: Buffer): Buffer => {
  const out = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(out, 0);
  out.writeUInt8(1, 7);
  out.writeUInt8(1, 8);
  out.writeUInt32BE(iterations, 9);
  salt.copy(out, 13);
  out.writeUInt8(1, 29);
  out.writeBigUInt64BE(BigInt(writtenAtMs), 30);
  nonce.copy(out, 38);
  return out;
};

export const seal = (
  plaintext: string,
  passphrase: string,
  salt: Buffer,
  iterations: number,
  writtenAtMs: number,
  nonce: Buffer,
): Buffer => {
  const head = header(salt, iterations, writtenAtMs, nonce);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt, iterations), nonce);
  cipher.setAAD(head);
  const body = Buffer.concat([cipher.update(zlib.deflateRawSync(Buffer.from(plaintext, 'utf8'))), cipher.final()]);
  return Buffer.concat([head, body, cipher.getAuthTag()]);
};

export type OpenError = 'notBackup' | 'newerFormat' | 'wrongPassphrase' | 'damaged';

export const open = (file: Buffer, passphrase: string): {ok: true; text: string} | {ok: false; error: OpenError} => {
  if (file.length < HEADER_BYTES + TAG_BYTES || !file.subarray(0, 7).equals(MAGIC)) {
    return {ok: false, error: 'notBackup'};
  }
  if (file.readUInt8(7) !== 1 || file.readUInt8(8) !== 1 || file.readUInt8(29) !== 1) {
    return {ok: false, error: 'newerFormat'};
  }
  const iterations = file.readUInt32BE(9);
  if (iterations < 1_000 || iterations > 10_000_000) {
    return {ok: false, error: 'notBackup'};
  }
  const head = file.subarray(0, HEADER_BYTES);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, file.subarray(13, 29), iterations),
    file.subarray(38, 50),
  );
  decipher.setAAD(head);
  decipher.setAuthTag(file.subarray(file.length - TAG_BYTES));
  let compressed: Buffer;
  try {
    compressed = Buffer.concat([
      decipher.update(file.subarray(HEADER_BYTES, file.length - TAG_BYTES)),
      decipher.final(),
    ]);
  } catch {
    return {ok: false, error: 'wrongPassphrase'};
  }
  try {
    return {ok: true, text: zlib.inflateRawSync(compressed, {maxOutputLength: 256 * 1024 * 1024}).toString('utf8')};
  } catch {
    return {ok: false, error: 'damaged'};
  }
};
