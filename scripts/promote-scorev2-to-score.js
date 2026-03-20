/**
 * One-time migration:
 * - Overwrite `score` with `scoreV2` for user rating docs
 * - Remove `scoreV2` afterward
 *
 * Path:
 *   users/{uid}/ratings/{ratingDocId}
 *
 * Usage:
 *   node scripts/promote-scorev2-to-score.js --dry-run
 *   node scripts/promote-scorev2-to-score.js --yes
 *   node scripts/promote-scorev2-to-score.js --uid=<uid> --yes
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

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
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

async function getUserIds(db, onlyUid) {
  if (onlyUid) return [onlyUid];
  const usersSnap = await db.collection('users').get();
  return usersSnap.docs.map((d) => d.id);
}

async function processUser(db, uid, dryRun) {
  const ratingsRef = db.collection('users').doc(uid).collection('ratings');
  const snap = await ratingsRef.get();

  if (snap.empty) return { scanned: 0, toUpdate: 0, updated: 0 };

  const updates = [];
  snap.docs.forEach((d) => {
    const data = d.data() || {};
    if (typeof data.scoreV2 === 'string' && data.scoreV2.length > 0) {
      updates.push({ ref: d.ref, score: data.scoreV2 });
    }
  });

  if (!dryRun) {
    const FieldValue = admin.firestore.FieldValue;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = updates.slice(i, i + BATCH_SIZE);
      chunk.forEach((u) => {
        batch.update(u.ref, {
          score: u.score,
          scoreV2: FieldValue.delete(),
        });
      });
      await batch.commit();
    }
  }

  return {
    scanned: snap.size,
    toUpdate: updates.length,
    updated: dryRun ? 0 : updates.length,
  };
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON path.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  const onlyUid = getArg('uid');
  const dryRun = hasFlag('dry-run');
  const yes = hasFlag('yes');

  const userIds = await getUserIds(db, onlyUid);
  console.log(`Users to process: ${userIds.length}${dryRun ? ' (dry-run)' : ''}`);

  if (!dryRun && !yes) {
    const proceed = await promptYesNo('Promote scoreV2 -> score and delete scoreV2? (y/n): ');
    if (!proceed) {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  let scannedTotal = 0;
  let toUpdateTotal = 0;
  let updatedTotal = 0;

  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i];
    const result = await processUser(db, uid, dryRun);
    scannedTotal += result.scanned;
    toUpdateTotal += result.toUpdate;
    updatedTotal += result.updated;

    if ((i + 1) % 25 === 0 || i === userIds.length - 1) {
      console.log(`Processed ${i + 1}/${userIds.length} users...`);
    }
  }

  console.log(`Done.${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Rating docs scanned: ${scannedTotal}`);
  console.log(`Docs with scoreV2 found: ${toUpdateTotal}`);
  if (!dryRun) {
    console.log(`Docs updated (score overwritten, scoreV2 removed): ${updatedTotal}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

