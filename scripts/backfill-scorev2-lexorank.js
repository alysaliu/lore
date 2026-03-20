/**
 * One-time backfill: write LexoRank keys to `scoreV2` for rating docs in:
 *   users/{uid}/ratings/{ratingDocId}
 *
 * Rating doc ID formats supported:
 * - movie_{id}
 * - tv_{id}_show
 * - tv_{id}_{seasonNumber}
 * - tv_{id}_s{seasonNumber}
 *
 * Strategy:
 * - For each user, group ratings by (mediaType, sentiment)
 * - Sort each group by existing numeric `score` DESC (higher score = better rank)
 * - Assign evenly spaced LexoRank keys in that order and write to `scoreV2`
 *
 * Safety:
 * - Script only performs update writes (`batch.update`)
 * - No deletes are performed
 *
 * Usage:
 *   node scripts/backfill-scorev2-lexorank.js --yes
 *   node scripts/backfill-scorev2-lexorank.js --uid=<uid> --yes
 *   node scripts/backfill-scorev2-lexorank.js --dry-run
 *
 * Prereqs:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
/* eslint-disable no-console */

const admin = require('firebase-admin');
const readline = require('readline');

const BATCH_SIZE = 500;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const KEY_LENGTH = 12;

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function promptYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = String(answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

function parseMediaFromDocId(docId) {
  if (typeof docId !== 'string') return null;

  if (docId.startsWith('movie_')) {
    const id = Number(docId.slice('movie_'.length));
    if (Number.isFinite(id)) return { mediaType: 'movie', mediaId: id, segment: null };
  }

  // tv_{id}_show | tv_{id}_{season} | tv_{id}_s{season}
  const tv = docId.match(/^tv_(\d+)_(show|s\d+|\d+)$/);
  if (tv) {
    const mediaId = Number(tv[1]);
    const raw = tv[2];
    const season = raw === 'show' ? null : Number(raw.startsWith('s') ? raw.slice(1) : raw);
    if (Number.isFinite(mediaId)) {
      return {
        mediaType: 'tv',
        mediaId,
        segment: season == null || Number.isNaN(season) ? null : season,
      };
    }
  }

  return null;
}

function getConfig() {
  const base = BigInt(ALPHABET.length);
  const maxValue = (base ** BigInt(KEY_LENGTH)) - 1n;
  return { base, maxValue };
}

function encodeRankValue(value) {
  const { base, maxValue } = getConfig();
  if (typeof value !== 'bigint') throw new Error('value must be a bigint');
  if (value < 0n || value > maxValue) {
    throw new Error(`value must be between 0 and ${maxValue.toString()}`);
  }

  let v = value;
  const chars = new Array(KEY_LENGTH).fill(ALPHABET[0]);
  for (let i = KEY_LENGTH - 1; i >= 0; i--) {
    const digit = Number(v % base);
    chars[i] = ALPHABET[digit];
    v /= base;
  }
  return chars.join('');
}

function rebalanceRankKeys(count) {
  if (!Number.isInteger(count) || count < 0) throw new Error('count must be a non-negative integer');
  if (count === 0) return [];

  const { maxValue } = getConfig();
  const totalSlots = maxValue + 1n;
  const step = totalSlots / BigInt(count + 1);
  if (step < 1n) throw new Error('not enough key space for requested count');

  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push(encodeRankValue(step * BigInt(i)));
  }
  return out;
}

function normalizeMediaType(raw, docId) {
  if (raw === 'movie' || raw === 'tv') return raw;
  const parsed = parseMediaFromDocId(docId);
  return parsed?.mediaType || 'movie';
}

function numericScore(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function sortGroupEntries(a, b) {
  // Better items first.
  const scoreDiff = numericScore(b.data.score) - numericScore(a.data.score);
  if (scoreDiff !== 0) return scoreDiff;

  // Stable deterministic tie-breakers.
  const ta = a.data.timestamp ? String(a.data.timestamp) : '';
  const tb = b.data.timestamp ? String(b.data.timestamp) : '';
  if (ta !== tb) return ta.localeCompare(tb);
  return a.doc.id.localeCompare(b.doc.id);
}

async function commitUpdates(db, updates, dryRun) {
  if (dryRun || updates.length === 0) return;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_SIZE);
    chunk.forEach((u) => batch.update(u.ref, { scoreV2: u.scoreV2 }));
    await batch.commit();
  }
}

async function processUserRatings(db, uid, dryRun) {
  const colRef = db.collection('users').doc(uid).collection('ratings');
  const snap = await colRef.get();
  if (snap.empty) return { docs: 0, updates: 0, groups: 0 };

  const groups = new Map(); // key = mediaType|sentiment -> [{ doc, data }]
  snap.docs.forEach((d) => {
    const data = d.data() || {};
    const mediaType = normalizeMediaType(data.mediaType, d.id);
    const sentiment = data.sentiment || 'good';
    const key = `${mediaType}|${sentiment}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ doc: d, data });
  });

  const updates = [];
  for (const entries of groups.values()) {
    entries.sort(sortGroupEntries);
    const rankKeys = rebalanceRankKeys(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const next = rankKeys[i];
      if (entry.data.scoreV2 !== next) {
        updates.push({ ref: entry.doc.ref, scoreV2: next });
      }
    }
  }

  await commitUpdates(db, updates, dryRun);
  return { docs: snap.size, updates: updates.length, groups: groups.size };
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON path.');
    process.exit(1);
  }

  const onlyUid = getArg('uid');
  const dryRun = hasFlag('dry-run');
  const yes = hasFlag('yes');

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  let userIds;
  if (onlyUid) {
    userIds = [onlyUid];
  } else {
    const usersSnap = await db.collection('users').get();
    userIds = usersSnap.docs.map((d) => d.id);
  }

  console.log(`Users to process: ${userIds.length}${dryRun ? ' (dry-run)' : ''}`);

  if (!yes && !dryRun) {
    const proceed = await promptYesNo('Write scoreV2 to Firestore? (y/n): ');
    if (!proceed) {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  let totalDocs = 0;
  let totalUpdates = 0;
  let totalGroups = 0;

  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i];
    const result = await processUserRatings(db, uid, dryRun);
    totalDocs += result.docs;
    totalUpdates += result.updates;
    totalGroups += result.groups;
    if ((i + 1) % 25 === 0 || i === userIds.length - 1) {
      console.log(`Processed ${i + 1}/${userIds.length} users...`);
    }
  }

  console.log(`Done.${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Ratings docs scanned: ${totalDocs}`);
  console.log(`(mediaType,sentiment) groups ranked: ${totalGroups}`);
  console.log(`Docs updated with scoreV2: ${totalUpdates}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

