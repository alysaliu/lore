/**
 * One-off migration: move each user's `ratings` field into a subcollection
 * users/{userId}/ratings so documents don't hit the 1MB limit.
 *
 * Flow: 1) Fetch all users and ratings, write to CSV. 2) Prompt (y/n). 3) If y, run migration.
 *
 * Prerequisites:
 *   1. npm install firebase-admin (or use from project root)
 *   2. Download a service account key from Firebase Console → Project settings → Service accounts → Generate new private key
 *   3. Set env: GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account.json
 *   Then: node scripts/migrate-ratings-to-subcollection.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BATCH_SIZE = 500;
const EXPORT_CSV_PATH = path.join(__dirname, 'users-ratings-export.csv');

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function getRatingDocId(mediaType, mediaId, season) {
  if (mediaType === 'movie') return `movie_${mediaId}`;
  return `tv_${mediaId}_${season != null ? season : 'show'}`;
}

function flattenRatings(ratings) {
  const byId = new Map();
  if (!ratings || typeof ratings !== 'object') return [];
  for (const mediaType of ['movie', 'tv']) {
    const byType = ratings[mediaType];
    if (!byType || typeof byType !== 'object') continue;
    for (const sentiment of Object.keys(byType)) {
      const entries = byType[sentiment];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || entry.mediaId == null) continue;
        const docId = getRatingDocId(mediaType, entry.mediaId, entry.season);
        const existing = byId.get(docId);
        const score = entry.score ?? 0;
        if (!existing || score > (existing.data.score ?? 0)) {
          byId.set(docId, {
            id: docId,
            data: {
              mediaType: entry.mediaType || mediaType,
              sentiment,
              mediaId: entry.mediaId,
              note: entry.note ?? null,
              score: entry.score,
              timestamp: entry.timestamp || null,
              ...(entry.season != null && { season: entry.season }),
            },
          });
        }
      }
    }
  }
  return Array.from(byId.values());
}

function promptYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

async function fetchAndExportToCsv(usersSnap) {
  const header = 'uid,username,displayName,ratingCount,mediaType,sentiment,mediaId,season,score,note,timestamp';
  const rows = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const username = data.username ?? '';
    const displayName = data.displayName ?? '';
    const ratingCount = data.ratingCount ?? '';
    const ratings = data.ratings;
    const entries = flattenRatings(ratings || {});

    if (entries.length === 0) {
      rows.push([uid, username, displayName, ratingCount, '', '', '', '', '', '', ''].map(escapeCsv).join(','));
      continue;
    }

    for (const { data: d } of entries) {
      rows.push([
        uid,
        username,
        displayName,
        ratingCount,
        d.mediaType,
        d.sentiment,
        d.mediaId,
        d.season ?? '',
        d.score ?? '',
        d.note ?? '',
        d.timestamp ?? '',
      ].map(escapeCsv).join(','));
    }
  }

  const csv = [header, ...rows].join('\n');
  fs.writeFileSync(EXPORT_CSV_PATH, csv, 'utf8');
  return { rowCount: rows.length };
}

async function runMigration(db, usersSnap) {
  let usersWithRatings = 0;
  let totalRatingsMoved = 0;
  let errors = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const ratings = data.ratings;

    if (!ratings || (typeof ratings === 'object' && !Object.keys(ratings).length)) continue;

    const entries = flattenRatings(ratings);
    if (entries.length === 0) continue;

    usersWithRatings++;
    const ratingsRef = db.collection('users').doc(uid).collection('ratings');

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = entries.slice(i, i + BATCH_SIZE);
      for (const { id, data: ratingData } of chunk) {
        const ref = ratingsRef.doc(id);
        batch.set(ref, ratingData);
      }
      try {
        await batch.commit();
        totalRatingsMoved += chunk.length;
      } catch (e) {
        console.error(`Batch write failed for user ${uid}:`, e.message);
        errors++;
      }
    }

    try {
      await userDoc.ref.update({ ratings: admin.firestore.FieldValue.delete() });
    } catch (e) {
      console.error(`Failed to remove ratings field for user ${uid}:`, e.message);
      errors++;
    }
  }

  console.log('Migration complete.');
  console.log(`Users with ratings processed: ${usersWithRatings}`);
  console.log(`Rating docs written to subcollections: ${totalRatingsMoved}`);
  if (errors) console.log(`Errors: ${errors}`);
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the path to your Firebase service account JSON.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  console.log('Fetching all users and ratings (read-only)...');
  const usersSnap = await db.collection('users').get();
  const { rowCount } = await fetchAndExportToCsv(usersSnap);
  console.log(`Exported ${usersSnap.size} users, ${rowCount} rows to:\n  ${EXPORT_CSV_PATH}`);
  console.log('Review the CSV, then answer below to proceed with database changes.\n');

  const proceed = await promptYesNo('Apply migration to Firestore? (y/n): ');
  if (!proceed) {
    console.log('Aborted. No database changes made.');
    return;
  }

  await runMigration(db, usersSnap);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
