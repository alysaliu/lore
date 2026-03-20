/**
 * Remove ratings for one uid ONLY from mediaRatings denormalized collection:
 *   mediaRatings/{mediaKey}/userRatings/*
 * and decrement mediaRatings/{mediaKey}.ratingCount.
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
    const proceed = await promptYesNo(`Remove mediaRatings/userRatings docs for ${uid}? (y/n): `);
    if (!proceed) {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  const refs = [];
  const removedCountByMediaKey = new Map();

  // Try collectionGroup first; fallback to per-media query if index missing.
  try {
    const denormSnap = await db.collectionGroup('userRatings').where('uid', '==', uid).get();
    denormSnap.docs.forEach((d) => {
      const parts = d.ref.path.split('/'); // mediaRatings/{mediaKey}/userRatings/{docId}
      if (parts.length >= 4 && parts[0] === 'mediaRatings' && parts[2] === 'userRatings') {
        const mediaKey = parts[1];
        removedCountByMediaKey.set(mediaKey, (removedCountByMediaKey.get(mediaKey) || 0) + 1);
        refs.push(d.ref);
      }
    });
  } catch (e) {
    console.warn('collectionGroup query failed, using per-media fallback:', e.code || e.message);
    const mediaSnap = await db.collection('mediaRatings').get();
    for (const mediaDoc of mediaSnap.docs) {
      const mediaKey = mediaDoc.id;
      const userSnap = await db.collection('mediaRatings').doc(mediaKey).collection('userRatings').where('uid', '==', uid).get();
      userSnap.docs.forEach((d) => {
        removedCountByMediaKey.set(mediaKey, (removedCountByMediaKey.get(mediaKey) || 0) + 1);
        refs.push(d.ref);
      });
    }
  }

  if (!dryRun) {
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

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
  console.log(`Denormalized userRatings docs found: ${refs.length}`);
  console.log(`mediaRatings aggregates affected: ${removedCountByMediaKey.size}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

