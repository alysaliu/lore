/**
 * One-time backfill: add `mediaName` to existing docs in
 * `users/{uid}/ratings/{ratingDocId}`.
 *
 * Why:
 * - Your UI can avoid TMDB name lookups if each rating doc already stores `mediaName`.
 *
 * How it infers media identity:
 * - Movies: `movie_{movieId}` (and tolerates `move_{movieId}` typo prefix)
 * - TV whole show: `tv_{tvId}_show`
 * - TV season: `tv_{tvId}_s{seasonNumber}`
 *   (also tolerates `tv_{tvId}_{seasonNumber}` just in case)
 *
 * Prereqs:
 *  1) npm install firebase-admin (already in devDependencies)
 *  2) GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *  3) NEXT_PUBLIC_TMDB_API_KEY=...
 *  4) node scripts/backfill-user-rating-media-names.js
 */
/* eslint-disable no-console */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.themoviedb.org/3';
let API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

function loadEnvVarFromFile(filePath, varName) {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    const line = contents
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#') && l.startsWith(`${varName}=`));
    if (!line) return null;
    return line.slice(varName.length + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return null;
  }
}

function getTmdbUrl(mediaType, mediaId) {
  // We only need title/name for display; credits append isn't necessary.
  return `${BASE_URL}/${mediaType}/${mediaId}?api_key=${API_KEY}&language=en-US`;
}

function parseMediaFromDocId(docId) {
  if (typeof docId !== 'string') return null;

  // Movie: movie_{id} (or tolerate move_{id})
  if (docId.startsWith('movie_') || docId.startsWith('move_')) {
    const parts = docId.split('_');
    const mediaId = Number(parts[1]);
    if (!Number.isFinite(mediaId)) return null;
    return { mediaType: 'movie', mediaId };
  }

  // TV: tv_{id}_show | tv_{id}_s{season} | tv_{id}_{season}
  const tvMatch = docId.match(/^tv_(\d+)_((show)|s\d+|\d+)$/);
  if (!tvMatch) return null;
  const mediaId = Number(tvMatch[1]);
  if (!Number.isFinite(mediaId)) return null;
  return { mediaType: 'tv', mediaId };
}

async function fetchMediaName(mediaType, mediaId) {
  const url = getTmdbUrl(mediaType, mediaId);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return mediaType === 'movie' ? data?.title ?? null : data?.name ?? null;
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the path to your Firebase service account JSON.');
    process.exit(1);
  }
  if (!API_KEY) {
    // Allow local dev convenience: read from root .env.local (or .env) without needing dotenv.
    const candidates = ['.env.local', '.env'].map((p) => path.join(process.cwd(), p));
    for (const file of candidates) {
      API_KEY = loadEnvVarFromFile(file, 'NEXT_PUBLIC_TMDB_API_KEY');
      if (API_KEY) break;
    }
  }
  if (!API_KEY) {
    console.error('Set NEXT_PUBLIC_TMDB_API_KEY (env var or in root .env.local/.env).');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  console.log('Scanning all rating docs via collectionGroup("ratings")...');
  const snap = await db.collectionGroup('ratings').get();
  console.log(`Found ${snap.size} rating doc(s).`);

  let missing = 0;
  for (const d of snap.docs) {
    const data = d.data() || {};
    if (data.mediaName == null || data.mediaName === '') missing += 1;
  }
  console.log(`Docs missing mediaName: ${missing}`);

  if (missing === 0) {
    console.log('Nothing to do.');
    return;
  }

  const proceed = await (async () => {
    // Avoid pulling readline boilerplate: require explicit `--yes` in CI.
    if (process.argv.includes('--yes')) return true;
    process.stdout.write('Proceed with updates? Type "yes" to continue: ');
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('', (answer) => {
        rl.close();
        resolve(String(answer || '').trim().toLowerCase() === 'yes');
      });
    });
  })();

  if (!proceed) {
    console.log('Aborted. No changes made.');
    return;
  }

  const nameCache = new Map(); // `${mediaType}:${mediaId}` -> name or null
  const updateBatchSize = 500; // Firestore max for write batch

  let batch = db.batch();
  let batchCount = 0;
  let updated = 0;
  let skipped = 0;

  // Sequential loop to keep TMDB requests under control.
  for (const d of snap.docs) {
    const data = d.data() || {};
    const existing = data.mediaName;
    if (existing != null && existing !== '') {
      skipped += 1;
      continue;
    }

    const docId = d.id;
    const parsed = parseMediaFromDocId(docId);
    const mediaType = data.mediaType || parsed?.mediaType || 'movie';
    const mediaId = data.mediaId != null ? Number(data.mediaId) : parsed?.mediaId;

    if (!Number.isFinite(mediaId)) {
      console.warn(`Skipping ${d.ref.path}: cannot determine mediaId`);
      continue;
    }

    const cacheKey = `${mediaType}:${mediaId}`;
    if (!nameCache.has(cacheKey)) {
      const name = await fetchMediaName(mediaType, mediaId);
      nameCache.set(cacheKey, name);
      // Small log so you can see progress even when batch writes are delayed.
      if (name) console.log(`Fetched ${mediaType} ${mediaId}: ${name}`);
    }

    const mediaName = nameCache.get(cacheKey);
    batch.update(d.ref, { mediaName });
    batchCount += 1;
    updated += 1;

    if (batchCount >= updateBatchSize) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
      console.log(`Committed updates so far: ${updated}`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Done. Updated: ${updated}, skipped (already had name): ${skipped}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

