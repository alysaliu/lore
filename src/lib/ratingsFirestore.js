/**
 * Read/write ratings from the users/{uid}/ratings subcollection.
 * Same logical shape as before: { movie: { [sentiment]: [entries] }, tv: { ... } }
 */
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';

const BATCH_SIZE = 500;
const AGGREGATE_FIELDS = { ratingCount: 0, sumScores: 0 };

export function getRatingDocId(mediaType, mediaId, season) {
  if (mediaType === 'movie') return `movie_${mediaId}`;
  return `tv_${mediaId}_${season != null ? season : 'show'}`;
}

/**
 * Get the overall average rating and count from the aggregate doc at mediaRatings/{mediaKey}.
 * @param {string} mediaKey - e.g. movie_123 or tv_456
 * @returns {Promise<{ average: number, count: number } | null>}
 */
export async function getMediaAverageRating(mediaKey) {
  if (!db || !mediaKey) return null;
  const aggRef = doc(db, 'mediaRatings', mediaKey);
  const snap = await getDoc(aggRef);
  const data = snap.exists() ? snap.data() : null;
  const count = data && typeof data.ratingCount === 'number' ? data.ratingCount : 0;
  const sum = data && typeof data.sumScores === 'number' ? data.sumScores : 0;
  if (count === 0) return null;
  const average = Math.round((sum / count) * 10) / 10;
  return { average, count };
}

/**
 * Fetch all rating docs for a user and return the nested shape:
 * { movie: { [sentiment]: [{ mediaId, mediaType?, note, score, timestamp, season? }] }, tv: { ... } }
 */
export async function getRatings(uid) {
  if (!db) return { movie: {}, tv: {} };
  const colRef = collection(db, 'users', uid, 'ratings');
  const snap = await getDocs(colRef);
  const ratings = { movie: {}, tv: {} };
  snap.docs.forEach((d) => {
    const data = d.data();
    const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
    const sentiment = data.sentiment || 'good';
    if (!ratings[mediaType][sentiment]) ratings[mediaType][sentiment] = [];
    ratings[mediaType][sentiment].push({
      mediaId: data.mediaId,
      mediaType: data.mediaType || mediaType,
      note: data.note ?? null,
      score: data.score,
      timestamp: data.timestamp ?? null,
      ...(data.season != null && { season: data.season }),
    });
  });
  return ratings;
}

function flattenRatingsToEntries(ratings) {
  const entries = [];
  if (!ratings || typeof ratings !== 'object') return entries;
  for (const mediaType of ['movie', 'tv']) {
    const byType = ratings[mediaType];
    if (!byType || typeof byType !== 'object') continue;
    for (const sentiment of Object.keys(byType)) {
      const arr = byType[sentiment];
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (!entry || entry.mediaId == null) continue;
        const docId = getRatingDocId(mediaType, entry.mediaId, entry.season);
        entries.push({
          id: docId,
          data: {
            mediaType: entry.mediaType || mediaType,
            sentiment,
            mediaId: entry.mediaId,
            note: entry.note ?? null,
            score: entry.score,
            timestamp: entry.timestamp ?? null,
            ...(entry.season != null && { season: entry.season }),
          },
        });
      }
    }
  }
  return entries;
}

/**
 * Write the full ratings object to the subcollection (replaces existing).
 * Deletes any subcollection docs not in the new ratings.
 */
export async function saveRatings(uid, ratings) {
  if (!db) return;
  const colRef = collection(db, 'users', uid, 'ratings');
  const entries = flattenRatingsToEntries(ratings);
  const newIds = new Set(entries.map((e) => e.id));

  // 1) Sync per-user ratings subcollection
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = entries.slice(i, i + BATCH_SIZE);
    for (const { id, data } of chunk) {
      batch.set(doc(colRef, id), data);
    }
    await batch.commit();
  }

  const existingSnap = await getDocs(colRef);
  const toDelete = existingSnap.docs.filter((d) => !newIds.has(d.id));

  // Remove from mediaRatings and update aggregates before deleting from user ratings
  for (const d of toDelete) {
    const parsed = parseUserRatingDocId(d.id);
    if (parsed) {
      const ratingDocId = `${uid}_${parsed.segmentId}`;
      try {
        await deleteMediaRatingEntry(parsed.mediaKey, ratingDocId);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('deleteMediaRatingEntry failed for', parsed.mediaKey, ratingDocId, e);
      }
    }
  }

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  // 2) Sync denormalized mediaRatings/{mediaKey}/userRatings docs for this user (and update aggregates)
  await syncMediaRatingsForUser(uid, entries);
}

/**
 * Delete all rating docs in the subcollection. Caller should also set ratingCount on the user doc.
 */
export async function deleteAllRatings(uid) {
  if (!db) return;
  const colRef = collection(db, 'users', uid, 'ratings');
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

/**
 * Parse a user rating doc id (users/{uid}/ratings doc id) to get mediaKey and segmentId.
 * @returns {{ mediaKey: string, segmentId: string } | null}
 */
function parseUserRatingDocId(userRatingDocId) {
  if (typeof userRatingDocId !== 'string') return null;
  if (userRatingDocId.startsWith('movie_')) {
    return { mediaKey: userRatingDocId, segmentId: 'show' };
  }
  const tvMatch = userRatingDocId.match(/^tv_(\d+)_(show|s\d+)$/);
  if (tvMatch) {
    return { mediaKey: `tv_${tvMatch[1]}`, segmentId: tvMatch[2] };
  }
  return null;
}

/**
 * Delete one user rating from mediaRatings and update the aggregate (ratingCount, sumScores).
 * Call when a user removes a rating (saveRatings removal or details page delete).
 */
export async function deleteMediaRatingEntry(mediaKey, ratingDocId) {
  if (!db || !mediaKey || !ratingDocId) return;
  const aggRef = doc(db, 'mediaRatings', mediaKey);
  const userRatingRef = doc(aggRef, 'userRatings', ratingDocId);

  await runTransaction(db, async (transaction) => {
    const [ratingSnap, aggSnap] = await Promise.all([
      transaction.get(userRatingRef),
      transaction.get(aggRef),
    ]);
    const score = ratingSnap.exists() && typeof ratingSnap.data().score === 'number'
      ? ratingSnap.data().score
      : 0;
    const agg = aggSnap.exists() ? aggSnap.data() : AGGREGATE_FIELDS;
    const count = (typeof agg.ratingCount === 'number' ? agg.ratingCount : 0) - 1;
    const sumScores = (typeof agg.sumScores === 'number' ? agg.sumScores : 0) - score;
    const newCount = Math.max(0, count);
    const newSum = newCount === 0 ? 0 : sumScores;

    transaction.delete(userRatingRef);
    transaction.set(aggRef, { ratingCount: newCount, sumScores: newSum });
  });
}

/**
 * Keep mediaRatings/{mediaKey}/userRatings in sync for a single user, based on
 * the flattened per-user rating entries. Also updates the aggregate (ratingCount, sumScores)
 * on the mediaRatings/{mediaKey} document.
 */
async function syncMediaRatingsForUser(uid, flattenedEntries) {
  if (!db) return;

  // Deduplicate by media + season for this user's ratings in memory
  const byKey = new Map();
  for (const { data } of flattenedEntries) {
    const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
    const mediaKey = mediaType === 'movie' ? `movie_${data.mediaId}` : `tv_${data.mediaId}`;
    const segmentId = data.season != null ? `s${data.season}` : 'show';
    const key = `${mediaKey}|${segmentId}`;

    const existing = byKey.get(key);
    if (!existing || (data.score ?? 0) > (existing.score ?? 0)) {
      byKey.set(key, { mediaKey, segmentId, data });
    }
  }

  for (const { mediaKey, segmentId, data } of byKey.values()) {
    const docId = `${uid}_${segmentId}`;
    const aggRef = doc(db, 'mediaRatings', mediaKey);
    const userRatingRef = doc(aggRef, 'userRatings', docId);
    const score = typeof data.score === 'number' ? data.score : 0;

    await runTransaction(db, async (transaction) => {
      const [existingSnap, aggSnap] = await Promise.all([
        transaction.get(userRatingRef),
        transaction.get(aggRef),
      ]);
      const agg = aggSnap.exists() ? aggSnap.data() : AGGREGATE_FIELDS;
      const count = typeof agg.ratingCount === 'number' ? agg.ratingCount : 0;
      const sumScores = typeof agg.sumScores === 'number' ? agg.sumScores : 0;

      const isUpdate = existingSnap.exists();
      const oldScore = isUpdate && typeof existingSnap.data().score === 'number'
        ? existingSnap.data().score
        : 0;
      const newCount = isUpdate ? count : count + 1;
      const newSum = isUpdate ? sumScores - oldScore + score : sumScores + score;

      transaction.set(userRatingRef, {
        uid,
        mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
        mediaId: data.mediaId,
        sentiment: data.sentiment,
        score: data.score,
        note: data.note ?? null,
        timestamp: data.timestamp ?? null,
        ...(data.season != null && { season: data.season }),
      });
      transaction.set(aggRef, { ratingCount: newCount, sumScores: newSum });
    });
  }
}
