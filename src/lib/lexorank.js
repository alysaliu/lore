/**
 * Lexicographic rank-key utilities using fixed-width base-N strings.
 *
 * This is a LexoRank-like approach designed for predictable ordering and
 * low write amplification:
 * - Keys are fixed-width strings (default length 12)
 * - Sort ascending by key for rank order
 * - Insert between two keys with keyBetween(left, right)
 * - Rebalance by generating evenly spaced keys
 */

export const DEFAULT_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const DEFAULT_KEY_LENGTH = 12;

function getConfig(options = {}) {
  const alphabet = options.alphabet ?? DEFAULT_ALPHABET;
  const length = options.length ?? DEFAULT_KEY_LENGTH;

  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('length must be a positive integer');
  }
  if (typeof alphabet !== 'string' || alphabet.length < 2) {
    throw new Error('alphabet must be a string with at least 2 unique characters');
  }
  const unique = new Set(alphabet.split(''));
  if (unique.size !== alphabet.length) {
    throw new Error('alphabet must not contain duplicate characters');
  }

  const base = BigInt(alphabet.length);
  const maxValue = (base ** BigInt(length)) - 1n;
  return { alphabet, length, base, maxValue };
}

function toIndexMap(alphabet) {
  const m = new Map();
  for (let i = 0; i < alphabet.length; i++) {
    m.set(alphabet[i], i);
  }
  return m;
}

export function isValidRankKey(key, options = {}) {
  try {
    decodeRankKey(key, options);
    return true;
  } catch {
    return false;
  }
}

export function decodeRankKey(key, options = {}) {
  const { alphabet, length, base } = getConfig(options);
  if (typeof key !== 'string') throw new Error('key must be a string');
  if (key.length !== length) throw new Error(`key must be exactly ${length} characters`);
  const index = toIndexMap(alphabet);
  let value = 0n;
  for (const ch of key) {
    const digit = index.get(ch);
    if (digit == null) {
      throw new Error(`key contains character not present in alphabet: "${ch}"`);
    }
    value = (value * base) + BigInt(digit);
  }
  return value;
}

export function encodeRankValue(value, options = {}) {
  const { alphabet, length, base, maxValue } = getConfig(options);
  if (typeof value !== 'bigint') throw new Error('value must be a bigint');
  if (value < 0n || value > maxValue) {
    throw new Error(`value must be between 0 and ${maxValue.toString()}`);
  }

  let v = value;
  const chars = new Array(length).fill(alphabet[0]);
  for (let i = length - 1; i >= 0; i--) {
    const digit = Number(v % base);
    chars[i] = alphabet[digit];
    v = v / base;
  }
  return chars.join('');
}

export function compareRankKeys(a, b, options = {}) {
  const av = decodeRankKey(a, options);
  const bv = decodeRankKey(b, options);
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

export function createInitialRankKey(options = {}) {
  const { maxValue } = getConfig(options);
  const mid = maxValue / 2n;
  return encodeRankValue(mid, options);
}

/**
 * Create a key strictly between left and right.
 *
 * @param {string|null} leftKey - Lower bound (exclusive). Null means "no lower bound".
 * @param {string|null} rightKey - Upper bound (exclusive). Null means "no upper bound".
 * @returns {string|null} A key between bounds, or null when there is no space.
 */
export function keyBetween(leftKey, rightKey, options = {}) {
  const { maxValue } = getConfig(options);
  const left = leftKey == null ? -1n : decodeRankKey(leftKey, options);
  const right = rightKey == null ? (maxValue + 1n) : decodeRankKey(rightKey, options);

  if (left >= right) {
    throw new Error('leftKey must be strictly less than rightKey');
  }

  // We need an integer n such that left < n < right.
  const candidate = (left + right) / 2n;
  if (candidate <= left || candidate >= right) {
    return null;
  }
  return encodeRankValue(candidate, options);
}

/**
 * Generate evenly spaced keys for rebalancing an ordered list.
 *
 * @param {number} count - Number of keys to produce.
 * @returns {string[]} keys sorted ascending.
 */
export function rebalanceRankKeys(count, options = {}) {
  const { maxValue } = getConfig(options);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('count must be a non-negative integer');
  }
  if (count === 0) return [];

  // Spread keys over [0..maxValue] with sentinel endpoints:
  // step = floor((maxValue + 1) / (count + 1))
  const totalSlots = maxValue + 1n;
  const step = totalSlots / BigInt(count + 1);
  if (step < 1n) {
    throw new Error('not enough key space for requested count; increase key length');
  }

  const out = [];
  for (let i = 1; i <= count; i++) {
    const v = step * BigInt(i);
    out.push(encodeRankValue(v, options));
  }
  return out;
}

