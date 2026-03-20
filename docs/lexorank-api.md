# LexoRank Utility API

This document describes the API for `src/lib/lexorank.js` in a strict, LLM-friendly format.

## Module Purpose

Provide lexicographic rank-key primitives for ordered lists with low write amplification:

- Represent order with fixed-width sortable strings (`rankKey`)
- Insert an item between neighbors with one new key
- Rebalance keys when spacing becomes tight

## Data Model

- **Rank key type:** `string`
- **Default alphabet:** `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`
- **Default key length:** `12`
- **Ordering rule:** ascending lexicographic order of `rankKey`

## Shared Options Type

```ts
type LexoRankOptions = {
  alphabet?: string; // unique chars, length >= 2
  length?: number;   // positive integer, fixed key width
};
```

If omitted, defaults are used.

## API Surface

### `isValidRankKey(key, options?)`

```ts
function isValidRankKey(key: unknown, options?: LexoRankOptions): boolean
```

- **Parameters**
  - `key`: any value, expected rank key string
  - `options`: optional config (`alphabet`, `length`)
- **Returns**
  - `true` if `key` decodes successfully for the given config
  - `false` otherwise

---

### `decodeRankKey(key, options?)`

```ts
function decodeRankKey(key: string, options?: LexoRankOptions): bigint
```

- **Parameters**
  - `key`: fixed-width rank key string
  - `options`: optional config
- **Returns**
  - numeric rank value as `bigint`
- **Throws**
  - if key type is invalid
  - if key length does not match config length
  - if key contains characters outside alphabet

---

### `encodeRankValue(value, options?)`

```ts
function encodeRankValue(value: bigint, options?: LexoRankOptions): string
```

- **Parameters**
  - `value`: rank value to encode
  - `options`: optional config
- **Returns**
  - fixed-width rank key string
- **Throws**
  - if `value` is not a bigint
  - if `value` is outside representable range for `(alphabet, length)`

---

### `compareRankKeys(a, b, options?)`

```ts
function compareRankKeys(a: string, b: string, options?: LexoRankOptions): -1 | 0 | 1
```

- **Parameters**
  - `a`, `b`: rank key strings
  - `options`: optional config
- **Returns**
  - `-1` if `a < b`
  - `0` if equal
  - `1` if `a > b`
- **Throws**
  - if either key is invalid for config

---

### `createInitialRankKey(options?)`

```ts
function createInitialRankKey(options?: LexoRankOptions): string
```

- **Parameters**
  - `options`: optional config
- **Returns**
  - a middle key in the available key space
- **Use case**
  - first item in a new ranked list

---

### `keyBetween(leftKey, rightKey, options?)`

```ts
function keyBetween(
  leftKey: string | null,
  rightKey: string | null,
  options?: LexoRankOptions
): string | null
```

- **Parameters**
  - `leftKey`: lower bound (exclusive), or `null` for no lower bound
  - `rightKey`: upper bound (exclusive), or `null` for no upper bound
  - `options`: optional config
- **Returns**
  - a new key strictly between bounds
  - `null` if no representable key exists between bounds
- **Throws**
  - if provided bounds are invalid keys
  - if `leftKey >= rightKey`

---

### `rebalanceRankKeys(count, options?)`

```ts
function rebalanceRankKeys(count: number, options?: LexoRankOptions): string[]
```

- **Parameters**
  - `count`: number of keys to generate
  - `options`: optional config
- **Returns**
  - sorted ascending array of `count` evenly spaced keys
- **Throws**
  - if `count` is not a non-negative integer
  - if key space is too small for requested `count`

---

### `rankKeyToScore(key, options?)`

```ts
function rankKeyToScore(
  key: string,
  options?: LexoRankOptions & { minScore?: number; maxScore?: number; precision?: number }
): number
```

- **Parameters**
  - `key`: rank key string
  - `options.minScore`: default `1`
  - `options.maxScore`: default `10`
  - `options.precision`: decimal places for rounding, default `1`
  - `options.alphabet`, `options.length`: optional key config
- **Returns**
  - numeric display score mapped from key position in keyspace
  - lower key (better rank) maps closer to `maxScore`
- **Throws**
  - if key is invalid
  - if score range/options are invalid

## Error Semantics

The library throws `Error` for invalid input and configuration constraints.
Callers should catch errors around unsafe user input.

## Typical Usage Pattern

1. Query ranked items ordered by `rankKey`.
2. Determine neighbors around insertion point.
3. Call `keyBetween(leftKey, rightKey)`.
4. If result is `null`, call `rebalanceRankKeys(listLength)` and rewrite keys for that list, then retry insertion.

## Stability Notes

- Keep `alphabet` and `length` constant for a given collection.
- Mixing configs across docs in the same list will break ordering expectations.
- Prefer a single config globally unless you have a migration plan.

