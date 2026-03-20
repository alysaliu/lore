/**
 * Backfill fullNameLower on users collection.
 *
 * Usage:
 *   node scripts/build-user-search-index.js --dry-run
 *   node scripts/build-user-search-index.js --yes
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

function normalize(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
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

  const dryRun = hasFlag('dry-run');
  const yes = hasFlag('yes');

  if (!dryRun && !yes) {
    const proceed = await promptYesNo('Backfill users/{uid}.fullNameLower for all users? (y/n): ');
    if (!proceed) {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users.${dryRun ? ' (dry-run)' : ''}`);

  let toWrite = 0;
  let skipped = 0;
  const writeOps = [];

  usersSnap.docs.forEach((userDoc) => {
    const uid = userDoc.id;
    const data = userDoc.data() || {};

    const firstname = normalize(data.firstname);
    const lastname = normalize(data.lastname);
    const fullName = `${firstname} ${lastname}`.trim();
    const fullNameLower = normalizeLower(fullName);

    if (!fullNameLower) {
      skipped += 1;
      return;
    }

    const payload = { fullNameLower };

    toWrite += 1;
    writeOps.push({ ref: db.collection('users').doc(uid), payload });
  });

  if (!dryRun) {
    for (let i = 0; i < writeOps.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = writeOps.slice(i, i + BATCH_SIZE);
      chunk.forEach(({ ref, payload }) => {
        batch.set(ref, payload, { merge: true });
      });
      await batch.commit();
    }
  }

  console.log(`User docs ${dryRun ? 'prepared' : 'updated'}: ${toWrite}`);
  console.log(`Users skipped (missing first+last): ${skipped}`);
  console.log(`Done.${dryRun ? ' (dry-run)' : ''}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

