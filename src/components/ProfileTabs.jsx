'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchMediaDetails } from '../lib/tmdb';
import MediaCard from './MediaCard';
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

    const itemRatings = [];
    for (const sentiment in data.movie || {}) {
      for (const entry of data.movie[sentiment]) {
        itemRatings.push({ ...entry, sentiment });
      }
    }

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

    const showRatings = [];
    for (const sentiment in data.tv || {}) {
      for (const entry of data.tv[sentiment]) {
        showRatings.push({ ...entry, sentiment });
      }
    }

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

  const renderContent = () => {
    if (activeTab === 'movies') {
      if (movies === null) return <p className={styles.emptyState}>Loading...</p>;
      if (movies.length === 0) return <p className={styles.emptyState}>No movies rated yet.</p>;
      return movies.map((item) => (
        <MediaCard
          key={item.mediaId}
          mediaId={item.mediaId}
          mediaType={item.mediaType || 'movie'}
          title={item.title}
          year={item.year}
          posterPath={item.posterPath}
          genres={item.genres}
          score={item.score}
          rank={item.rank}
          note={item.note}
          variant="profile"
        />
      ));
    }

    if (activeTab === 'shows') {
      if (shows === null) return <p className={styles.emptyState}>Loading...</p>;
      if (shows.length === 0) return <p className={styles.emptyState}>No shows rated yet.</p>;
      return shows.map((item) => (
        <MediaCard
          key={item.mediaId}
          mediaId={item.mediaId}
          mediaType="tv"
          title={item.title}
          year={item.year}
          posterPath={item.posterPath}
          genres={item.genres}
          score={item.score}
          rank={item.rank}
          note={item.note}
          variant="profile"
        />
      ));
    }

    if (activeTab === 'watchlist') {
      if (watchlist === null) return <p className={styles.emptyState}>Loading...</p>;
      if (watchlist.length === 0) return <p className={styles.emptyState}>No movies or shows added to your watchlist yet.</p>;
      return watchlist.map((item) => (
        <MediaCard
          key={`${item.mediaType}-${item.mediaId}`}
          mediaId={item.mediaId}
          mediaType={item.mediaType}
          title={item.title}
          year={item.year}
          posterPath={item.posterPath}
          genres={item.genres}
          overview={item.overview}
          variant="profile"
        />
      ));
    }
  };

  const tabs = [
    { key: 'movies', label: 'Rated movies' },
    { key: 'shows', label: 'Rated shows' },
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
