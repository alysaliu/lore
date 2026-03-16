/**
 * Backfill script: populate mediaRatings/{mediaKey}/userRatings docs for all users
 * based on existing users/{uid}/ratings subcollections.
 *
 * Usage:
 *   1. npm install firebase-admin
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. node scripts/backfill-media-ratings.js
 */

/* eslint-disable no-console */

const admin = require('firebase-admin');

const BATCH_SIZE = 500;

function getMediaKey(mediaType, mediaId) {
  if (mediaType === 'tv') return `tv_${mediaId}`;
  return `movie_${mediaId}`;
}

async function backfillUser(db, userDoc) {
  const uid = userDoc.id;
  const ratingsCol = db.collection('users').doc(uid).collection('ratings');
  const ratingsSnap = await ratingsCol.get();

  if (ratingsSnap.empty) {
    console.log(`User ${uid}: no ratings, skipping.`);
    return;
  }

  // Build in-memory map: mediaKey|segmentId -> { mediaKey, segmentId, data }
  const byKey = new Map();
  ratingsSnap.forEach((snap) => {
    const d = snap.data();
    if (!d || d.mediaId == null) return;
    const mediaType = d.mediaType === 'tv' ? 'tv' : 'movie';
    const mediaKey = getMediaKey(mediaType, d.mediaId);
    const segmentId = d.season != null ? `s${d.season}` : 'show';
    const key = `${mediaKey}|${segmentId}`;
    const existing = byKey.get(key);
    const score = d.score ?? 0;
    if (!existing || score > (existing.data.score ?? 0)) {
      byKey.set(key, { mediaKey, segmentId, data: d });
    }
  });

  const desiredPaths = new Set();

  // Compute desired doc paths for this user's ratings
  for (const { mediaKey, segmentId, data } of byKey.values()) {
    const docId = `${uid}_${segmentId}`;
    const ref = db
      .collection('mediaRatings')
      .doc(mediaKey)
      .collection('userRatings')
      .doc(docId);
    desiredPaths.add(ref.path);
  }

  // Write/overwrite the desired docs
  let written = 0;
  for (const { mediaKey, segmentId, data } of byKey.values()) {
    const docId = `${uid}_${segmentId}`;
    const ref = db
      .collection('mediaRatings')
      .doc(mediaKey)
      .collection('userRatings')
      .doc(docId);
    await ref.set({
      uid,
      mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
      mediaId: data.mediaId,
      sentiment: data.sentiment,
      score: data.score,
      note: data.note ?? null,
      timestamp: data.timestamp ?? null,
      ...(data.season != null && { season: data.season }),
    });
    written += 1;
  }

  console.log(`User ${uid}: backfilled ${written} mediaRatings doc(s).`);
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to the path to your Firebase service account JSON.'
    );
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  console.log('Fetching all users...');
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users. Starting backfill...`);

  let processed = 0;
  for (const userDoc of usersSnap.docs) {
    await backfillUser(db, userDoc);
    processed += 1;
    if (processed % 10 === 0) {
      console.log(`Processed ${processed}/${usersSnap.size} users...`);
    }
  }

  console.log('Backfill complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

