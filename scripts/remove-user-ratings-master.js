/**
 * Remove ratings for one uid ONLY.
 *
 * Supports both shapes:
 * - Legacy: mediaRatings/{mediaKey}/userRatings/{uid_show|uid_s1|...}
 * - Current: mediaRatings/{mediaKey}/userRatings/{uid} and /seasons/{season}
 *
 * Also removes:
 * - users/{uid}/ratings/* (including nested seasons)
 *
 * Usage:
 *   node scripts/remove-user-ratings-master.js --uid=<uid> --yes
 *   node scripts/remove-user-ratings-master.js --uid=<uid> --dry-run
 *
 * Prereq:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
/* eslint-disable no-console */

const admin = require('firebase-admin');
const readline = require('readline');

const BATCH_SIZE = 500;

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

async function commitDeletes(db, refs, dryRun) {
  if (dryRun || refs.length === 0) return;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON path.');
    process.exit(1);
  }

  const uid = getArg('uid');
  const dryRun = hasFlag('dry-run');
  const yes = hasFlag('yes');
  if (!uid) {
    console.error('Missing required --uid=<uid> argument');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  console.log(`Target uid: ${uid}${dryRun ? ' (dry-run)' : ''}`);
  if (!dryRun && !yes) {
    const proceed = await promptYesNo(`Remove ratings for ONLY uid ${uid} from users + mediaRatings? (y/n): `);
    if (!proceed) {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  const refsToDelete = [];
  const removedCountByMediaKey = new Map();
  let nestedSeasonsFound = 0;
  let nestedParentsFound = 0;
  let legacyFound = 0;
  let userRootRatingsFound = 0;
  let userSeasonRatingsFound = 0;

  // Remove source ratings under users/{uid}/ratings (new nested + any legacy flat docs).
  const userRatingsRoot = db.collection('users').doc(uid).collection('ratings');
  const userRatingsSnap = await userRatingsRoot.get();
  for (const ratingDoc of userRatingsSnap.docs) {
    refsToDelete.push(ratingDoc.ref);
    userRootRatingsFound += 1;
    const seasonsSnap = await ratingDoc.ref.collection('seasons').get();
    seasonsSnap.docs.forEach((seasonDoc) => {
      refsToDelete.push(seasonDoc.ref);
      userSeasonRatingsFound += 1;
    });
  }

  const mediaSnap = await db.collection('mediaRatings').get();
  for (const mediaDoc of mediaSnap.docs) {
    const mediaKey = mediaDoc.id;
    const userRatingsCol = db.collection('mediaRatings').doc(mediaKey).collection('userRatings');

    // New shape: mediaRatings/{mediaKey}/userRatings/{uid}
    const parentRef = userRatingsCol.doc(uid);
    const parentSnap = await parentRef.get();
    if (parentSnap.exists) {
      refsToDelete.push(parentRef);
      nestedParentsFound += 1;
      removedCountByMediaKey.set(mediaKey, (removedCountByMediaKey.get(mediaKey) || 0) + 1);
    }

    // New shape seasons: mediaRatings/{mediaKey}/userRatings/{uid}/seasons/{season}
    const seasonsSnap = await parentRef.collection('seasons').get();
    seasonsSnap.docs.forEach((d) => {
      refsToDelete.push(d.ref);
      nestedSeasonsFound += 1;
      removedCountByMediaKey.set(mediaKey, (removedCountByMediaKey.get(mediaKey) || 0) + 1);
    });

    // Legacy shape fallback: mediaRatings/{mediaKey}/userRatings/{uid_segment}
    const legacySnap = await userRatingsCol.where('uid', '==', uid).get();
    legacySnap.docs.forEach((d) => {
      if (d.id === uid) return; // already counted as nested parent above
      refsToDelete.push(d.ref);
      legacyFound += 1;
      removedCountByMediaKey.set(mediaKey, (removedCountByMediaKey.get(mediaKey) || 0) + 1);
    });
  }

  await commitDeletes(db, refsToDelete, dryRun);

  if (!dryRun) {
    for (const [mediaKey, removedCount] of removedCountByMediaKey.entries()) {
      const aggRef = db.collection('mediaRatings').doc(mediaKey);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(aggRef);
        const data = snap.exists ? snap.data() : {};
        const current = typeof data.ratingCount === 'number' ? data.ratingCount : 0;
        tx.set(aggRef, { ratingCount: Math.max(0, current - removedCount) }, { merge: true });
      });
    }
  }

  console.log(`Done.${dryRun ? ' (dry-run)' : ''}`);
  console.log(`users/{uid}/ratings root docs found: ${userRootRatingsFound}`);
  console.log(`users/{uid}/ratings nested season docs found: ${userSeasonRatingsFound}`);
  console.log(`Nested parent docs found: ${nestedParentsFound}`);
  console.log(`Nested season docs found: ${nestedSeasonsFound}`);
  console.log(`Legacy docs found: ${legacyFound}`);
  console.log(`Total denormalized docs found: ${refsToDelete.length}`);
  console.log(`mediaRatings aggregates affected: ${removedCountByMediaKey.size}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

