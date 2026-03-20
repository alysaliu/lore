const {
  DEFAULT_ALPHABET,
  DEFAULT_KEY_LENGTH,
  isValidRankKey,
  decodeRankKey,
  encodeRankValue,
  compareRankKeys,
  createInitialRankKey,
  keyBetween,
  rebalanceRankKeys,
  rankKeyToScore,
} = require('../lexorank');

function assertStrictlyAscending(keys, opts) {
  for (let i = 1; i < keys.length; i++) {
    expect(compareRankKeys(keys[i - 1], keys[i], opts)).toBe(-1);
  }
}

describe('lexorank config and validation', () => {
  test('exports default alphabet and key length', () => {
    expect(DEFAULT_ALPHABET).toBe('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
    expect(DEFAULT_KEY_LENGTH).toBe(12);
  });

  test('isValidRankKey returns false for wrong length / charset', () => {
    expect(isValidRankKey('abc')).toBe(false);
    expect(isValidRankKey('!!!!!!!!!!!!')).toBe(false);
  });

  test('decode throws for wrong key type', () => {
    expect(() => decodeRankKey(123)).toThrow(/string/);
    expect(() => decodeRankKey(null)).toThrow(/string/);
  });

  test('decode throws for wrong key length', () => {
    expect(() => decodeRankKey('12345', { length: 6 })).toThrow(/exactly 6/);
  });

  test('invalid options are rejected: duplicate alphabet chars', () => {
    expect(() => decodeRankKey('0000', { alphabet: '0012', length: 4 })).toThrow(/duplicate/);
  });

  test('invalid options are rejected: alphabet size < 2', () => {
    expect(() => decodeRankKey('0000', { alphabet: '0', length: 4 })).toThrow(/at least 2/);
  });

  test('invalid options are rejected: non-positive / non-integer length', () => {
    expect(() => decodeRankKey('0000', { length: 0 })).toThrow(/positive integer/);
    expect(() => decodeRankKey('0000', { length: -1 })).toThrow(/positive integer/);
    expect(() => decodeRankKey('0000', { length: 3.2 })).toThrow(/positive integer/);
  });
});

describe('encode/decode', () => {
  test('encode then decode round-trips bigint values', () => {
    const opts = { length: 6 };
    const values = [0n, 1n, 15n, 12345n, 999999n];
    for (const v of values) {
      const key = encodeRankValue(v, opts);
      const decoded = decodeRankKey(key, opts);
      expect(decoded).toBe(v);
      expect(key).toHaveLength(6);
    }
  });

  test('round-trip works for default config at boundary-like values', () => {
    const values = [0n, 1n, 123456789n, 999999999999n];
    for (const v of values) {
      const key = encodeRankValue(v);
      expect(decodeRankKey(key)).toBe(v);
    }
  });

  test('decode throws on invalid character', () => {
    expect(() => decodeRankKey('00000!', { length: 6 })).toThrow(/character/);
  });

  test('encode throws for out of range value', () => {
    const opts = { alphabet: '01', length: 2 }; // max = 3
    expect(() => encodeRankValue(4n, opts)).toThrow(/between 0 and 3/);
  });

  test('encode throws for negative values', () => {
    expect(() => encodeRankValue(-1n, { alphabet: '01', length: 4 })).toThrow(/between 0 and/);
  });

  test('encode throws when value is not bigint', () => {
    expect(() => encodeRankValue(123, { length: 6 })).toThrow(/bigint/);
  });

  test('lexicographic ordering equals numeric ordering for fixed-width keys', () => {
    const opts = { length: 6 };
    const keys = [];
    for (let i = 0n; i <= 50n; i++) {
      keys.push(encodeRankValue(i, opts));
    }
    const sorted = [...keys].sort();
    expect(sorted).toEqual(keys);
  });

  test('supports custom small alphabet and still round-trips', () => {
    const opts = { alphabet: 'abc', length: 5 };
    const values = [0n, 1n, 2n, 10n, 121n];
    for (const v of values) {
      const key = encodeRankValue(v, opts);
      expect(decodeRankKey(key, opts)).toBe(v);
      expect(isValidRankKey(key, opts)).toBe(true);
    }
  });

  test('encodes and decodes the maximum representable value', () => {
    const opts = { alphabet: '01', length: 4 }; // max = 15
    const maxValue = 15n;
    const maxKey = encodeRankValue(maxValue, opts);
    expect(maxKey).toBe('1111');
    expect(decodeRankKey(maxKey, opts)).toBe(maxValue);
  });
});

describe('compareRankKeys', () => {
  test('orders keys correctly', () => {
    const opts = { length: 6 };
    const a = encodeRankValue(100n, opts);
    const b = encodeRankValue(101n, opts);
    expect(compareRankKeys(a, b, opts)).toBe(-1);
    expect(compareRankKeys(b, a, opts)).toBe(1);
    expect(compareRankKeys(a, a, opts)).toBe(0);
  });

  test('is transitive across three keys', () => {
    const opts = { length: 6 };
    const a = encodeRankValue(10n, opts);
    const b = encodeRankValue(20n, opts);
    const c = encodeRankValue(30n, opts);
    expect(compareRankKeys(a, b, opts)).toBe(-1);
    expect(compareRankKeys(b, c, opts)).toBe(-1);
    expect(compareRankKeys(a, c, opts)).toBe(-1);
  });
});

describe('createInitialRankKey', () => {
  test('returns a valid middle-ish key', () => {
    const key = createInitialRankKey();
    expect(key).toHaveLength(DEFAULT_KEY_LENGTH);
    expect(isValidRankKey(key)).toBe(true);
  });

  test('initial key is inside bounds (not min / not max)', () => {
    const opts = { alphabet: '01', length: 8 };
    const key = createInitialRankKey(opts);
    const min = encodeRankValue(0n, opts);
    const max = encodeRankValue((2n ** 8n) - 1n, opts);
    expect(compareRankKeys(min, key, opts)).toBe(-1);
    expect(compareRankKeys(key, max, opts)).toBe(-1);
  });

  test('returns floor(maxValue / 2) encoded for the configured space', () => {
    const opts = { alphabet: '01', length: 4 }; // max = 15, mid = 7
    expect(createInitialRankKey(opts)).toBe(encodeRankValue(7n, opts));
  });
});

describe('keyBetween', () => {
  test('returns a key when both bounds are null', () => {
    const key = keyBetween(null, null, { length: 6 });
    expect(key).not.toBeNull();
    expect(isValidRankKey(key, { length: 6 })).toBe(true);
  });

  test('returns key strictly between two existing keys', () => {
    const opts = { length: 6 };
    const left = encodeRankValue(100n, opts);
    const right = encodeRankValue(200n, opts);
    const mid = keyBetween(left, right, opts);
    expect(mid).not.toBeNull();
    expect(compareRankKeys(left, mid, opts)).toBe(-1);
    expect(compareRankKeys(mid, right, opts)).toBe(-1);
  });

  test('returns the exact midpoint when there is odd-width numeric space', () => {
    const opts = { alphabet: '01', length: 4 };
    const left = encodeRankValue(2n, opts);
    const right = encodeRankValue(8n, opts);
    const mid = keyBetween(left, right, opts);
    expect(mid).toBe(encodeRankValue(5n, opts));
  });

  test('returns deterministic key for same bounds', () => {
    const opts = { length: 6 };
    const left = encodeRankValue(100n, opts);
    const right = encodeRankValue(200n, opts);
    const k1 = keyBetween(left, right, opts);
    const k2 = keyBetween(left, right, opts);
    expect(k1).toBe(k2);
  });

  test('supports open-ended right bound', () => {
    const opts = { length: 6 };
    const left = encodeRankValue(1000n, opts);
    const k = keyBetween(left, null, opts);
    expect(k).not.toBeNull();
    expect(compareRankKeys(left, k, opts)).toBe(-1);
  });

  test('supports open-ended left bound', () => {
    const opts = { length: 6 };
    const right = encodeRankValue(1000n, opts);
    const k = keyBetween(null, right, opts);
    expect(k).not.toBeNull();
    expect(compareRankKeys(k, right, opts)).toBe(-1);
  });

  test('returns null when left is immediately before upper sentinel', () => {
    const opts = { alphabet: '01', length: 3 }; // max = 7, upper sentinel = 8
    const left = encodeRankValue(7n, opts);
    const k = keyBetween(left, null, opts);
    expect(k).toBeNull();
  });

  test('returns null when right is immediately after lower sentinel', () => {
    const opts = { alphabet: '01', length: 3 };
    const right = encodeRankValue(0n, opts);
    const k = keyBetween(null, right, opts);
    expect(k).toBeNull();
  });

  test('returns null when there is no integer space between keys', () => {
    const opts = { alphabet: '01', length: 3 };
    const left = encodeRankValue(3n, opts);
    const right = encodeRankValue(4n, opts);
    const k = keyBetween(left, right, opts);
    expect(k).toBeNull();
  });

  test('throws when bounds are invalid order', () => {
    const opts = { length: 6 };
    const a = encodeRankValue(10n, opts);
    const b = encodeRankValue(20n, opts);
    expect(() => keyBetween(b, a, opts)).toThrow(/strictly less/);
  });

  test('throws when bounds are equal', () => {
    const opts = { length: 6 };
    const a = encodeRankValue(10n, opts);
    expect(() => keyBetween(a, a, opts)).toThrow(/strictly less/);
  });

  test('throws when a bound key is invalid for the configured alphabet', () => {
    const opts = { alphabet: '01', length: 4 };
    expect(() => keyBetween('0002', null, opts)).toThrow(/character/);
    expect(() => keyBetween(null, '2', opts)).toThrow(/exactly 4/);
  });

  test('repeated insertion between same bounds eventually runs out of space', () => {
    // Small space to force exhaustion quickly.
    const opts = { alphabet: '01', length: 8 }; // 256 values
    const left = encodeRankValue(10n, opts);
    const right = encodeRankValue(11n, opts);
    expect(keyBetween(left, right, opts)).toBeNull();
  });

  test('can keep inserting between moving bounds until exhaustion', () => {
    const opts = { length: 6 };
    let left = encodeRankValue(100n, opts);
    const right = encodeRankValue(1000n, opts);
    const generated = [];
    for (let i = 0; i < 1000; i++) {
      const mid = keyBetween(left, right, opts);
      if (mid == null) break;
      generated.push(mid);
      expect(compareRankKeys(left, mid, opts)).toBe(-1);
      expect(compareRankKeys(mid, right, opts)).toBe(-1);
      left = mid;
    }
    expect(generated.length).toBeGreaterThan(0);
    assertStrictlyAscending(generated, opts);
    // The next call should now be exhausted for this path.
    expect(keyBetween(left, right, opts)).toBeNull();
  });
});

describe('rebalanceRankKeys', () => {
  test('returns empty array when count is zero', () => {
    expect(rebalanceRankKeys(0, { length: 6 })).toEqual([]);
  });

  test('returns sorted, unique, evenly distributed keys', () => {
    const opts = { length: 6 };
    const keys = rebalanceRankKeys(20, opts);
    expect(keys).toHaveLength(20);

    const unique = new Set(keys);
    expect(unique.size).toBe(20);

    assertStrictlyAscending(keys, opts);
  });

  test('throws when key space cannot fit requested count', () => {
    const opts = { alphabet: '01', length: 2 }; // 4 total slots
    expect(() => rebalanceRankKeys(10, opts)).toThrow(/not enough key space/);
  });

  test('throws for invalid count inputs', () => {
    expect(() => rebalanceRankKeys(-1, { length: 6 })).toThrow(/non-negative integer/);
    expect(() => rebalanceRankKeys(1.5, { length: 6 })).toThrow(/non-negative integer/);
    expect(() => rebalanceRankKeys(NaN, { length: 6 })).toThrow(/non-negative integer/);
  });

  test('every produced key is valid under the provided config', () => {
    const opts = { alphabet: 'abcd', length: 8 };
    const keys = rebalanceRankKeys(30, opts);
    keys.forEach((k) => {
      expect(isValidRankKey(k, opts)).toBe(true);
      expect(k).toHaveLength(8);
    });
  });

  test('decoded values are approximately evenly spaced (difference <= 1)', () => {
    const opts = { alphabet: '01', length: 10 };
    const keys = rebalanceRankKeys(15, opts);
    const values = keys.map((k) => decodeRankKey(k, opts));
    const gaps = [];
    for (let i = 1; i < values.length; i++) {
      gaps.push(values[i] - values[i - 1]);
    }
    const minGap = gaps.reduce((m, g) => (g < m ? g : m), gaps[0]);
    const maxGap = gaps.reduce((m, g) => (g > m ? g : m), gaps[0]);
    expect(maxGap - minGap).toBeLessThanOrEqual(1n);
  });

  test('rebalanced keys are insert-friendly: keyBetween works for each adjacent pair', () => {
    const opts = { length: 6 };
    const keys = rebalanceRankKeys(25, opts);
    for (let i = 1; i < keys.length; i++) {
      const mid = keyBetween(keys[i - 1], keys[i], opts);
      expect(mid).not.toBeNull();
      expect(compareRankKeys(keys[i - 1], mid, opts)).toBe(-1);
      expect(compareRankKeys(mid, keys[i], opts)).toBe(-1);
    }
  });

  test('supports maximum fill without throwing when step is exactly one', () => {
    const opts = { alphabet: '01', length: 2 }; // total slots = 4
    const keys = rebalanceRankKeys(3, opts); // step = floor(4/4) = 1
    expect(keys).toEqual([
      encodeRankValue(1n, opts),
      encodeRankValue(2n, opts),
      encodeRankValue(3n, opts),
    ]);
    assertStrictlyAscending(keys, opts);
  });
});

describe('integration-like ranking flow', () => {
  test('simulates repeated insertions preserving global ordering', () => {
    const opts = { length: 8 };
    const list = [];

    // Start with one key.
    list.push(createInitialRankKey(opts));

    // Insert several items at different positions.
    for (let i = 0; i < 25; i++) {
      const insertAt = i % (list.length + 1);
      const left = insertAt === 0 ? null : list[insertAt - 1];
      const right = insertAt === list.length ? null : list[insertAt];
      const k = keyBetween(left, right, opts);
      expect(k).not.toBeNull();
      list.splice(insertAt, 0, k);
      assertStrictlyAscending(list, opts);
    }

    // Ensure all keys remain valid and unique.
    const unique = new Set(list);
    expect(unique.size).toBe(list.length);
    list.forEach((k) => expect(isValidRankKey(k, opts)).toBe(true));
  });
});

describe('rankKeyToScore', () => {
  test('maps best key to max score and worst key to min score', () => {
    const opts = { alphabet: '01', length: 4 };
    const best = encodeRankValue(0n, opts);
    const worst = encodeRankValue((2n ** 4n) - 1n, opts);
    expect(rankKeyToScore(best, opts)).toBe(10);
    expect(rankKeyToScore(worst, opts)).toBe(1);
  });

  test('maps middle key near center of score range', () => {
    const opts = { alphabet: '01', length: 8 };
    const mid = encodeRankValue(((2n ** 8n) - 1n) / 2n, opts);
    const score = rankKeyToScore(mid, opts);
    expect(score).toBeGreaterThan(5.4);
    expect(score).toBeLessThan(5.6);
  });

  test('supports custom min/max and precision', () => {
    const opts = { alphabet: '01', length: 8 };
    const key = encodeRankValue(0n, opts);
    expect(rankKeyToScore(key, { ...opts, minScore: 0, maxScore: 100, precision: 0 })).toBe(100);
  });

  test('throws on invalid score range', () => {
    const opts = { alphabet: '01', length: 8 };
    const key = encodeRankValue(0n, opts);
    expect(() => rankKeyToScore(key, { ...opts, minScore: 10, maxScore: 1 })).toThrow(/minScore/);
  });
});

