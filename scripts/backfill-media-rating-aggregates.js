/**
 * One-time backfill: set ratingCount and sumScores on each mediaRatings/{mediaKey}
 * by scanning all userRatings (via collection group). Run after deploying
 * aggregate-based getMediaAverageRating so existing media have correct aggregates.
 *
 * Why collection group? In Firestore, subcollections can exist without a parent
 * document. So mediaRatings/movie_123/userRatings/... docs exist but the document
 * mediaRatings/movie_123 may never have been created. db.collection('mediaRatings').get()
 * would then return 0 docs. This script uses collectionGroup('userRatings') to find
 * all rating docs, groups by mediaKey, then writes the aggregate doc for each.
 *
 * Usage:
 *   1. npm install firebase-admin
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. node scripts/backfill-media-rating-aggregates.js
 */

/* eslint-disable no-console */

const admin = require('firebase-admin');

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

  // Collection group query: all docs in any "userRatings" subcollection
  const snap = await db.collectionGroup('userRatings').get();
  // Group by mediaKey (parent of each doc is mediaRatings/{mediaKey})
  const byMediaKey = new Map(); // mediaKey -> { sumScores, count }
  snap.docs.forEach((d) => {
    const path = d.ref.path; // e.g. mediaRatings/movie_123/userRatings/uid_show
    const segments = path.split('/');
    if (segments[0] !== 'mediaRatings' || segments[2] !== 'userRatings') return;
    const mediaKey = segments[1];
    const score = d.data().score;
    if (typeof score !== 'number') return;
    if (!byMediaKey.has(mediaKey)) {
      byMediaKey.set(mediaKey, { sumScores: 0, count: 0 });
    }
    const agg = byMediaKey.get(mediaKey);
    agg.sumScores += score;
    agg.count += 1;
  });

  let updated = 0;
  for (const [mediaKey, agg] of byMediaKey) {
    const mediaRef = db.collection('mediaRatings').doc(mediaKey);
    await mediaRef.set({ ratingCount: agg.count, sumScores: agg.sumScores }, { merge: true });
    updated += 1;
    if (updated % 50 === 0) {
      console.log(`Updated ${updated} media aggregate(s)...`);
    }
  }

  console.log(`Backfill complete. Updated ${updated} media aggregate(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
