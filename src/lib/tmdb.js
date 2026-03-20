import { publicAssetPath } from './publicPath';

const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export async function searchMedia(query) {
  const res = await fetch(
    `${BASE_URL}/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`
  );
  const data = await res.json();
  const results = data.results || [];
  // Multi search includes people (actors); we only want movies and TV.
  return results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
}

/**
 * Search for movies only. Use this when you need reliable movie matching (e.g. Letterboxd import).
 * Pass year to narrow by primary_release_year.
 */
export async function searchMovies(query, year = null) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    query,
    page: '1',
    include_adult: 'false',
  });
  if (year) params.set('primary_release_year', String(year));
  const res = await fetch(`${BASE_URL}/search/movie?${params}`);
  const data = await res.json();
  return data.results || [];
}

export async function fetchMediaDetails(mediaType, id) {
  const res = await fetch(
    `${BASE_URL}/${mediaType}/${id}?api_key=${API_KEY}&language=en-US&append_to_response=credits`
  );
  return res.json();
}

export async function fetchMediaName(id, mediaType) {
  try {
    const data = await fetchMediaDetails(mediaType, id);
    return mediaType === 'movie' ? data.title : data.name;
  } catch {
    return null;
  }
}

export function getPosterUrl(posterPath, size = 'w185') {
  if (!posterPath) return publicAssetPath('/images/placeholder.png');
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

export function getOriginalUrl(posterPath) {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/original${posterPath}`;
}

export async function getPopularMedia() {
  const [moviesRes, tvRes] = await Promise.all([
    fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`),
    fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=1`),
  ]);
  const [movies, tv] = await Promise.all([moviesRes.json(), tvRes.json()]);
  const combined = [
    ...(movies.results || []).map((m) => ({ ...m, media_type: 'movie' })),
    ...(tv.results || []).map((t) => ({ ...t, media_type: 'tv' })),
  ].filter((item) => item.poster_path);
  // Shuffle
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.slice(0, 20);
}
