import { randomInt } from 'crypto';

/** Crockford-inspired lowercase alphabet (no i, l, o, u) — 32 symbols. */
const ALPHABET = '0123456789abcdefghjkmnpqrtvwxyz';

/** 12-character opaque public coin id for URLs / NFC. */
export function generateCoinPublicId(): string {
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
