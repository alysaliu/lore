'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Image from 'next/image';
import MediaCard from '../../components/MediaCard';
import { searchMedia } from '../../lib/tmdb';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import styles from './page.module.css';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = empty state, [] = no results
  const [selectedType, setSelectedType] = useState('all');
  const [watchlist, setWatchlist] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (!user) { setWatchlist([]); return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      setWatchlist(snap.exists() ? snap.data().lists?.watchlist || [] : []);
    });
    return () => unsubscribe();
  }, []);

  const handleWatchlistToggle = async (mediaId, mediaType) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    const lists = data.lists || {};
    const current = lists.watchlist || [];
    const isIn = current.some((item) => item.mediaId === mediaId);
    const updated = isIn
      ? current.filter((item) => item.mediaId !== mediaId)
      : [...current, { mediaId, mediaType, timestamp: new Date().toISOString() }];
    await setDoc(userRef, { lists: { ...lists, watchlist: updated } }, { merge: true });
    setWatchlist(updated);
  };

  const debouncedSearch = useMemo(
    () =>
      debounce(async (q, type) => {
        if (!q.trim()) {
          setResults(null);
          return;
        }
        const data = await searchMedia(q);
        const filtered =
          type === 'all' ? data : data.filter((item) => item.media_type === type);
        setResults(filtered);
      }, 300),
    []
  );

  const fetchResults = useCallback((q, type) => {
    debouncedSearch(q, type);
  }, [debouncedSearch]);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    fetchResults(val, selectedType);
  };

  const handleChip = (type) => {
    setSelectedType(type);
    // Re-filter current query with new type
    if (results !== null) {
      fetchResults(query, type);
    }
  };

  return (
    <div className={styles.searchSection}>
      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search movies and shows"
            className={styles.searchInput}
            value={query}
            onChange={handleInput}
          />
          <span className={styles.searchIcon}>
            <i className="fas fa-search" aria-hidden="true"></i>
          </span>
        </div>

        <div className={styles.filterContainer}>
          <span>Filter by</span>
          <div className={styles.chipContainer}>
            {['movie', 'tv'].map((type) => (
              <button
                key={type}
                className={selectedType === type ? styles.chipSelected : styles.chip}
                onClick={() => handleChip(type)}
              >
                {type === 'movie' ? 'Movies' : 'TV shows'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.resultsContainer}>
          {results === null ? (
            <div className={styles.emptyState}>
              <Image
                src="/images/Rabbit.svg"
                alt="Lore"
                width={60}
                height={60}
                className={styles.emptyLogo}
              />
              Start typing to enter a rabbithole!
            </div>
          ) : results.length === 0 ? (
            <div className={styles.emptyState}>No results found.</div>
          ) : (
            results.map((item) => {
              const title = item.title || item.name || 'No Title';
              const year = (item.release_date || item.first_air_date || '').split('-')[0];
              return (
                <MediaCard
                  key={`${item.media_type}-${item.id}`}
                  mediaId={item.id}
                  mediaType={item.media_type}
                  title={title}
                  year={year}
                  overview={item.overview}
                  posterPath={item.poster_path}
                  variant="grid"
                  inWatchlist={watchlist.some((w) => w.mediaId === String(item.id))}
                  onWatchlistToggle={handleWatchlistToggle}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
