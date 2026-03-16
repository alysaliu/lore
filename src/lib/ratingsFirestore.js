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
} from 'firebase/firestore';
import { db } from './firebase';

const BATCH_SIZE = 500;

export function getRatingDocId(mediaType, mediaId, season) {
  if (mediaType === 'movie') return `movie_${mediaId}`;
  return `tv_${mediaId}_${season != null ? season : 'show'}`;
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
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
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
