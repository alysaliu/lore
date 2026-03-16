/**
 * Parse Letterboxd ratings.csv and map to Lore format.
 * CSV: Date,Name,Year,Letterboxd URI,Rating
 * Letterboxd uses 0.5–5 stars; Lore uses 1–10 and sentiment buckets.
 */
import { searchMovies } from './tmdb';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getRatings, saveRatings } from './ratingsFirestore';

const SENTIMENT_RANGES = [
  { sentiment: 'not-good', min: 1, max: 3 },
  { sentiment: 'okay', min: 4, max: 6 },
  { sentiment: 'good', min: 7, max: 8 },
  { sentiment: 'amazing', min: 9, max: 10 },
];

function letterboxdRatingToLore(letterboxdRating) {
  const score = Math.round(Number(letterboxdRating) * 2 * 10) / 10;
  const clamped = Math.max(1, Math.min(10, score));
  const range = SENTIMENT_RANGES.find(
    (r) => clamped >= r.min && clamped <= r.max
  ) || SENTIMENT_RANGES[0];
  return { sentiment: range.sentiment, score: clamped };
}

/**
 * Parse ratings.csv text. Returns array of { name, year, rating } (skip header and empty).
 */
export function parseRatingsCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCells = parseCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  const nameIdx = headerCells.indexOf('name');
  const yearIdx = headerCells.indexOf('year');
  const ratingIdx = headerCells.indexOf('rating');
  if (nameIdx === -1 || yearIdx === -1 || ratingIdx === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = parseCsvLine(line);
    const name = parts[nameIdx]?.trim();
    const year = parts[yearIdx]?.trim();
    const rating = parts[ratingIdx]?.trim();
    if (!name) continue;
    rows.push({
      name,
      year: year ? String(year).replace(/\D/g, '').slice(0, 4) : '',
      rating: rating || '0',
    });
  }
  return rows;
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\n' || c === '\r') {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Resolve a movie by name and year via TMDB movie search. Returns { id } or null.
 * Uses /search/movie with primary_release_year so we get movies only and correct year match.
 */
export async function resolveMovieByNameAndYear(name, year) {
  const results = await searchMovies(name, year || undefined);
  if (!results.length) return null;
  return { id: results[0].id };
}

/**
 * Run import for the current user. Expects parsed rows from parseRatingsCsv.
 * Returns { successful, skipped, failed, details } where details is
 * array of { title, status: 'success'|'skipped'|'failed', reason? }.
 */
export async function importLetterboxdRatings(userId, rows) {
  const details = [];
  let successful = 0;
  let skipped = 0;
  let failed = 0;

  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  let ratings = await getRatings(userId);
  if (!ratings.movie) ratings.movie = {};
  const existingMovieIds = new Set();
  for (const sentiment of Object.keys(ratings.movie)) {
    for (const entry of ratings.movie[sentiment] || []) {
      existingMovieIds.add(Number(entry.mediaId));
    }
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await delay(250);
    const row = rows[i];
    const title = row.year ? `${row.name} (${row.year})` : row.name;
    try {
      const movie = await resolveMovieByNameAndYear(row.name, row.year);
      if (!movie) {
        failed++;
        details.push({ title, status: 'failed', reason: 'Not found on TMDB' });
        continue;
      }
      if (existingMovieIds.has(movie.id)) {
        skipped++;
        details.push({ title, status: 'skipped', reason: 'Already in your ratings' });
        continue;
      }
      const { sentiment, score } = letterboxdRatingToLore(row.rating);
      if (!ratings.movie[sentiment]) ratings.movie[sentiment] = [];
      ratings.movie[sentiment].push({
        mediaId: movie.id,
        mediaType: 'movie',
        score,
        note: null,
        timestamp: new Date().toISOString(),
      });
      existingMovieIds.add(movie.id);
      successful++;
      details.push({ title, status: 'success' });
    } catch (err) {
      failed++;
      details.push({
        title,
        status: 'failed',
        reason: err?.message || 'Error',
      });
    }
  }

  if (successful > 0) {
    await saveRatings(userId, ratings);
    const currentCount = userDoc.exists() && userDoc.data().ratingCount != null
      ? userDoc.data().ratingCount
      : 0;
    await updateDoc(userRef, { ratingCount: currentCount + successful });
  }

  return { successful, skipped, failed, details };
}
