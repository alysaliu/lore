'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchMediaDetails, getPosterUrl } from '../lib/tmdb';
import styles from './ProfileTabs.module.css';

/**
 * ProfileTabs — shared between /profile (current user) and /user (other users).
 *
 * Props:
 *   userId — Firestore uid to load data for
 */
export default function ProfileTabs({ userId }) {
  const [activeTab, setActiveTab] = useState('movies');
  const [movies, setMovies] = useState(null);
  const [shows, setShows] = useState(null);
  const [watchlist, setWatchlist] = useState(null);
  const [watchlistFilter, setWatchlistFilter] = useState('all');

  useEffect(() => {
    if (!userId) return;
    loadMovies(userId);
  }, [userId]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'movies' && movies === null) loadMovies(userId);
    if (tab === 'shows' && shows === null) loadShows(userId);
    if (tab === 'watchlist' && watchlist === null) loadWatchlist(userId);
  };

  const loadMovies = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.exists() ? userDoc.data().ratings || {} : {};

    const seen = new Map();
    for (const sentiment in data.movie || {}) {
      for (const entry of data.movie[sentiment]) {
        const key = String(entry.mediaId);
        if (!seen.has(key) || entry.score > seen.get(key).score) {
          seen.set(key, { ...entry, sentiment });
        }
      }
    }
    const itemRatings = Array.from(seen.values());

    if (itemRatings.length === 0) { setMovies([]); return; }

    itemRatings.sort((a, b) => b.score - a.score);
    itemRatings.forEach((item, i) => { item.rank = i + 1; });

    const enriched = await Promise.all(
      itemRatings.map(async (item) => {
        const d = await fetchMediaDetails('movie', item.mediaId);
        return {
          ...item,
          title: d.title || 'Untitled',
          year: (d.release_date || '').split('-')[0],
          posterPath: d.poster_path || '',
          genres: (d.genres || []).map((g) => g.name),
        };
      })
    );
    setMovies(enriched);
  };

  const loadShows = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.exists() ? userDoc.data().ratings || {} : {};

    const seen = new Map();
    for (const sentiment in data.tv || {}) {
      for (const entry of data.tv[sentiment]) {
        const key = String(entry.mediaId);
        if (!seen.has(key) || entry.score > seen.get(key).score) {
          seen.set(key, { ...entry, sentiment });
        }
      }
    }
    const showRatings = Array.from(seen.values());

    if (showRatings.length === 0) { setShows([]); return; }

    showRatings.sort((a, b) => b.score - a.score);
    showRatings.forEach((item, i) => { item.rank = i + 1; });

    const enriched = await Promise.all(
      showRatings.map(async (item) => {
        const d = await fetchMediaDetails('tv', item.mediaId);
        return {
          ...item,
          mediaType: 'tv',
          title: d.name || 'Untitled',
          year: (d.first_air_date || '').split('-')[0],
          posterPath: d.poster_path || '',
          genres: (d.genres || []).map((g) => g.name),
        };
      })
    );
    setShows(enriched);
  };

  const loadWatchlist = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.exists() ? userDoc.data() : {};
    const items = data.lists?.watchlist || [];

    if (items.length === 0) { setWatchlist([]); return; }

    const enriched = await Promise.all(
      items.map(async (item) => {
        const d = await fetchMediaDetails(item.mediaType, item.mediaId);
        return {
          mediaId: item.mediaId,
          mediaType: item.mediaType,
          title: d.title || d.name || 'Untitled',
          year: (d.release_date || d.first_air_date || '').split('-')[0],
          posterPath: d.poster_path || '',
          genres: (d.genres || []).map((g) => g.name),
          overview: d.overview || '',
        };
      })
    );
    setWatchlist(enriched);
  };

  const renderRatedRow = (item, mediaType) => (
    <div key={item.mediaId}>
      <Link
        href={`/details?id=${item.mediaId}&media_type=${mediaType}`}
        className={styles.ratedRow}
      >
        <span className={styles.rowRank}>{item.rank}</span>
        <img
          src={getPosterUrl(item.posterPath, 'w200')}
          alt={item.title}
          className={styles.rowPoster}
        />
        <div className={styles.rowInfo}>
          <div className={styles.rowTitleLine}>
            <span className={styles.rowTitle}>{item.title}</span>
            {item.year && <span className={styles.rowYear}>{item.year}</span>}
          </div>
          {item.note && <div className={styles.rowNote}>{item.note}</div>}
          {item.genres?.length > 0 && (
            <div className={styles.rowGenres}>
              {item.genres.map((g) => (
                <span key={g} className={styles.rowGenreBadge}>{g}</span>
              ))}
            </div>
          )}
        </div>
        {item.score != null && (
          <div className={styles.rowScore}>{item.score}</div>
        )}
      </Link>
      <hr className={styles.rowDivider} />
    </div>
  );

  const renderWatchlistRow = (item) => (
    <div key={`${item.mediaType}-${item.mediaId}`}>
      <Link
        href={`/details?id=${item.mediaId}&media_type=${item.mediaType}`}
        className={styles.ratedRow}
      >
        <img
          src={getPosterUrl(item.posterPath, 'w200')}
          alt={item.title}
          className={styles.rowPoster}
        />
        <div className={styles.rowInfo}>
          <div className={styles.rowTitleLine}>
            <span className={styles.rowTitle}>{item.title}</span>
            {item.year && <span className={styles.rowYear}>{item.year}</span>}
          </div>
          {item.overview && <div className={styles.rowNote}>{item.overview}</div>}
          {item.genres?.length > 0 && (
            <div className={styles.rowGenres}>
              {item.genres.map((g) => (
                <span key={g} className={styles.rowGenreBadge}>{g}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
      <hr className={styles.rowDivider} />
    </div>
  );

  const renderContent = () => {
    if (activeTab === 'movies') {
      if (movies === null) return <p className={styles.emptyState}>Loading...</p>;
      if (movies.length === 0) return <p className={styles.emptyState}>No movies rated yet.</p>;
      return movies.map((item) => renderRatedRow(item, item.mediaType || 'movie'));
    }

    if (activeTab === 'shows') {
      if (shows === null) return <p className={styles.emptyState}>Loading...</p>;
      if (shows.length === 0) return <p className={styles.emptyState}>No shows rated yet.</p>;
      return shows.map((item) => renderRatedRow(item, 'tv'));
    }

    if (activeTab === 'watchlist') {
      if (watchlist === null) return <p className={styles.emptyState}>Loading...</p>;
      if (watchlist.length === 0) return <p className={styles.emptyState}>No movies or shows added to your watchlist yet.</p>;
      const filtered = watchlistFilter === 'all' ? watchlist : watchlist.filter((item) => item.mediaType === watchlistFilter);
      return (
        <>
          <div className={styles.filterRow}>
            {['all', 'movie', 'tv'].map((type) => (
              <button
                key={type}
                className={watchlistFilter === type ? styles.chipSelected : styles.chip}
                onClick={() => setWatchlistFilter(type)}
              >
                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV shows'}
              </button>
            ))}
          </div>
          {filtered.length === 0
            ? <p className={styles.emptyState}>No {watchlistFilter === 'movie' ? 'movies' : 'TV shows'} in your watchlist.</p>
            : filtered.map((item) => renderWatchlistRow(item))
          }
        </>
      );
    }
  };

  const tabs = [
    { key: 'movies', label: 'Movies' },
    { key: 'shows', label: 'Shows' },
    { key: 'watchlist', label: 'Watchlist' },
  ];

  return (
    <>
      <div className={styles.tabs}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className={activeTab === key ? styles.tabActive : styles.tab}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.tabContent}>
        {renderContent()}
      </div>
    </>
  );
}
