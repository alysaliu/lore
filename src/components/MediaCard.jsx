import Link from 'next/link';
import Image from 'next/image';
import { getPosterUrl } from '../lib/tmdb';
import styles from './MediaCard.module.css';

/**
 * MediaCard — used in both explore results and profile rated/watchlist tabs.
 *
 * Props:
 *   mediaId      — TMDB id
 *   mediaType    — "movie" | "tv"
 *   title        — display title
 *   year         — release year string
 *   overview     — description text
 *   posterPath   — TMDB poster_path (e.g. "/abc123.jpg")
 *   genres       — string[] of genre names (optional)
 *   score        — numeric score (optional, profile tabs only)
 *   rank         — ranking number (optional)
 *   note         — user's note (optional)
 *   variant      — "explore" | "profile" (default "explore")
 */
export default function MediaCard({
  mediaId,
  mediaType,
  title,
  year,
  overview,
  posterPath,
  genres = [],
  score,
  rank,
  note,
  variant = 'explore',
  inWatchlist = false,
  onAddToList,
}) {
  const isProfile = variant === 'profile';
  const isGrid = variant === 'grid';
  const posterSize = isGrid ? 'w342' : isProfile ? 'w200' : 'w185';
  const posterUrl = getPosterUrl(posterPath, posterSize);

  if (isGrid) {
    return (
      <Link
        href={`/details?id=${mediaId}&media_type=${mediaType}`}
        className={styles.cardGrid}
      >
        <div className={styles.posterWrapper}>
          <Image src={posterUrl} alt={title} className={styles.posterGrid} width={342} height={513} />
          {onAddToList && (
            <button
              className={`${styles.watchlistBtn} ${inWatchlist ? styles.watchlistBtnActive : ''}`}
              onClick={(e) => { e.preventDefault(); onAddToList(String(mediaId), mediaType); }}
              data-tooltip="Add to list"
            >
              <i className="fas fa-plus"></i>
            </button>
          )}
        </div>
        <div className={styles.gridInfo}>
          <div className={styles.gridTitle}>{title}</div>
          {year && <div className={styles.gridYear}>{year}</div>}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/details?id=${mediaId}&media_type=${mediaType}`}
      className={`${styles.card} ${isProfile ? styles.cardProfile : ''}`}
    >
      <Image
        src={posterUrl}
        alt={title}
        className={isProfile ? styles.posterImageSmall : styles.posterImage}
        width={isProfile ? 200 : 185}
        height={isProfile ? 300 : 278}
      />
      <div className={styles.textContainer}>
        <div className={styles.titleContainer}>
          <div className={styles.header}>
            {rank != null ? `${rank}. ` : ''}{title}
          </div>
          {year && <div className={styles.metadata}>{year}</div>}
        </div>
        {genres.length > 0 && (
          <div className={styles.genres}>
            {genres.map((g) => (
              <span key={g} className={styles.genreBadge}>{g}</span>
            ))}
          </div>
        )}
        {(note || overview) && (
          <div className={styles.body}>{note || overview}</div>
        )}
      </div>
      {score != null && (
        <div className={styles.score}>{score}</div>
      )}
    </Link>
  );
}
