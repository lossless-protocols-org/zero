/**
 * Stands in for zod's `locales/index.js` in the app bundle (metro.config.js).
 * zod's classic API re-exports every locale as `z.locales`, so Metro, which
 * does not tree-shake, bundled its messages in 40-odd languages: 298 KB of
 * the 4.4 MB JS bundle (audit 2026-11-08 §8.5). zod registers English itself
 * (classic/schemas.js imports locales/en.js directly), and the app never
 * calls `z.config(z.locales.xx())`: backup errors carry their own English
 * text and are not translated.
 */
export {default as en} from 'zod/v4/locales/en.js';
