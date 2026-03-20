/**
 * One-way migration for TV rating shape (no backward compatibility):
 *
 * users side:
 *   FROM users/{uid}/ratings/tv_{mediaId}_{show|seasonNumber}
 *   TO   users/{uid}/ratings/tv_{mediaId}                        (whole-show fields)
 *        users/{uid}/ratings/tv_{mediaId}/seasons/{seasonNumber} (season fields)
 *
 * mediaRatings side:
 *   FROM mediaRatings/tv_{mediaId}/userRatings/{uid}_{show|sN}
 *   TO   mediaRatings/tv_{mediaId}/userRatings/{uid}                        (whole-show fields)
 *        mediaRatings/tv_{mediaId}/userRatings/{uid}/seasons/{seasonNumber} (season fields)
 *
 * Notes:
 * - This script migrates TV docs only.
 * - By default, this writes new docs and deletes old docs (true one-way migration).
 * - Use --dry-run to preview counts without writing.
 *
 * Usage:
 *   node scripts/backfill-tv-seasons-nested-structure.js --dry-run
 *   node scripts/backfill-tv-seasons-nested-structure.js --yes
 *
 * Prereq:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
/* eslint-disable no-console */

const admin = require('firebase-admin');
const readline = require('readline');

const BATCH_SIZE = 500;

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

function parseUserTvDocId(docId) {
  // tv_{id}_show OR tv_{id}_{seasonNumber}
  const m = /^tv_(.+)_(show|\d+)$/.exec(String(docId));
  if (!m) return null;
  return { mediaId: m[1], season: m[2] === 'show' ? null : Number(m[2]) };
}

function parseMediaRatingsUserDocId(docId) {
  // {uid}_show OR {uid}_s{seasonNumber}
  const m = /^(.+)_(show|s\d+)$/.exec(String(docId));
  if (!m) return null;
  const uid = m[1];
  const segment = m[2];
  if (segment === 'show') return { uid, season: null };
  const season = Number(segment.slice(1));
  if (!Number.isInteger(season) || season < 0) return null;
  return { uid, season };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function commitOps(db, ops, dryRun) {
  if (dryRun || ops.length === 0) return;
  for (const group of chunk(ops, BATCH_SIZE)) {
    const batch = db.batch();
    for (const op of group) {
      if (op.type === 'set') batch.set(op.ref, op.data, { merge: true });
      if (op.type === 'delete') batch.delete(op.ref);
    }
    await batch.commit();
  }
}

function buildBaseShowData(data) {
  return {
    mediaType: 'tv',
    mediaId: data.mediaId,
    sentiment: data.sentiment ?? null,
    mediaName: data.mediaName ?? null,
    note: data.note ?? null,
    score: data.score ?? null,
    scoreV2: data.scoreV2 ?? null,
    timestamp: data.timestamp ?? null,
  };
}

function buildSeasonData(data, season) {
  return {
    mediaType: 'tv',
    mediaId: data.mediaId,
    season,
    sentiment: data.sentiment ?? null,
    mediaName: data.mediaName ?? null,
    note: data.note ?? null,
    score: data.score ?? null,
    scoreV2: data.scoreV2 ?? null,
    timestamp: data.timestamp ?? null,
  };
}

async function migrateUsersSide(db, dryRun) {
  const usersSnap = await db.collection('users').get();
  const ops = [];
  let oldTvDocs = 0;
  let newShowDocs = 0;
  let newSeasonDocs = 0;
  let deletedOldDocs = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const ratingsSnap = await db.collection('users').doc(uid).collection('ratings').get();
    for (const ratingDoc of ratingsSnap.docs) {
      const parsed = parseUserTvDocId(ratingDoc.id);
      if (!parsed) continue;
      oldTvDocs += 1;

      const src = ratingDoc.data() || {};
      const mediaId = parsed.mediaId;
      const parentRef = db.collection('users').doc(uid).collection('ratings').doc(`tv_${mediaId}`);

      if (parsed.season == null) {
        ops.push({
          type: 'set',
          ref: parentRef,
          data: buildBaseShowData({ ...src, mediaId: src.mediaId ?? mediaId }),
        });
        newShowDocs += 1;
      } else {
        const seasonRef = parentRef.collection('seasons').doc(String(parsed.season));
        ops.push({
          type: 'set',
          ref: seasonRef,
          data: buildSeasonData({ ...src, mediaId: src.mediaId ?? mediaId }, parsed.season),
        });
        newSeasonDocs += 1;
      }

      if (ratingDoc.id !== `tv_${mediaId}`) {
        ops.push({ type: 'delete', ref: ratingDoc.ref });
        deletedOldDocs += 1;
      }
    }
  }

  await commitOps(db, ops, dryRun);
  return { oldTvDocs, newShowDocs, newSeasonDocs, deletedOldDocs };
}

async function migrateMediaRatingsSide(db, dryRun) {
  const mediaSnap = await db.collection('mediaRatings').get();
  const ops = [];
  let oldUserRatingDocs = 0;
  let newShowDocs = 0;
  let newSeasonDocs = 0;
  let deletedOldDocs = 0;

  for (const mediaDoc of mediaSnap.docs) {
    const mediaKey = mediaDoc.id;
    if (!String(mediaKey).startsWith('tv_')) continue;

    const userRatingsSnap = await db.collection('mediaRatings').doc(mediaKey).collection('userRatings').get();
    for (const userRatingDoc of userRatingsSnap.docs) {
      const parsed = parseMediaRatingsUserDocId(userRatingDoc.id);
      if (!parsed) continue;
      oldUserRatingDocs += 1;

      const src = userRatingDoc.data() || {};
      const mediaId = src.mediaId ?? mediaKey.replace(/^tv_/, '');
      const parentRef = db.collection('mediaRatings').doc(mediaKey).collection('userRatings').doc(parsed.uid);

      if (parsed.season == null) {
        ops.push({
          type: 'set',
          ref: parentRef,
          data: buildBaseShowData({ ...src, mediaId }),
        });
        newShowDocs += 1;
      } else {
        const seasonRef = parentRef.collection('seasons').doc(String(parsed.season));
        ops.push({
          type: 'set',
          ref: seasonRef,
          data: buildSeasonData({ ...src, mediaId }, parsed.season),
        });
        newSeasonDocs += 1;
      }

      if (userRatingDoc.id !== parsed.uid) {
        ops.push({ type: 'delete', ref: userRatingDoc.ref });
        deletedOldDocs += 1;
      }
    }
  }

  await commitOps(db, ops, dryRun);
  return { oldUserRatingDocs, newShowDocs, newSeasonDocs, deletedOldDocs };
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON path.');
    process.exit(1);
  }

  const dryRun = hasFlag('dry-run');
  const yes = hasFlag('yes');

  if (!dryRun && !yes) {
    console.log('This migration is one-way and deletes old TV docs after writing new nested docs.');
    const proceed = await promptYesNo('Proceed with migration? (y/n): ');
    if (!proceed) {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  console.log(`Starting TV structure migration${dryRun ? ' (dry-run)' : ''}...`);
  const usersStats = await migrateUsersSide(db, dryRun);
  const mediaStats = await migrateMediaRatingsSide(db, dryRun);

  console.log('');
  console.log('Users side:');
  console.log(`- old tv docs parsed: ${usersStats.oldTvDocs}`);
  console.log(`- new show docs written: ${usersStats.newShowDocs}`);
  console.log(`- new season docs written: ${usersStats.newSeasonDocs}`);
  console.log(`- old docs deleted: ${usersStats.deletedOldDocs}`);

  console.log('');
  console.log('mediaRatings side:');
  console.log(`- old userRatings docs parsed: ${mediaStats.oldUserRatingDocs}`);
  console.log(`- new show docs written: ${mediaStats.newShowDocs}`);
  console.log(`- new season docs written: ${mediaStats.newSeasonDocs}`);
  console.log(`- old docs deleted: ${mediaStats.deletedOldDocs}`);

  console.log('');
  console.log(`Done${dryRun ? ' (dry-run)' : ''}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

