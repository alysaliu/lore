'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MediaCard from '../../components/MediaCard';
import AddToListModal from '../../components/AddToListModal';
import { searchMedia } from '../../lib/tmdb';
import { publicAssetPath } from '../../lib/publicPath';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import styles from './page.module.css';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV shows' },
  { value: 'profiles', label: 'Profiles' },
];

async function searchProfileByUsername(query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;
  const usernameSnap = await getDoc(doc(db, 'usernames', trimmed));
  if (!usernameSnap.exists()) return null;
  const uid = usernameSnap.data().uid;
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return null;
  return { type: 'profile', uid: userSnap.id, ...userSnap.data() };
}

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
  const [modalMedia, setModalMedia] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (!user) { setWatchlist([]); return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      setWatchlist(snap.exists() ? snap.data().lists?.watchlist || [] : []);
    });
    return () => unsubscribe();
  }, []);

  const handleModalClose = async () => {
    setModalMedia(null);
    if (currentUser) {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      setWatchlist(snap.exists() ? snap.data().lists?.watchlist || [] : []);
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce(async (q, type) => {
        if (!q.trim()) {
          setResults(null);
          return;
        }
        if (type === 'profiles') {
          const profile = await searchProfileByUsername(q);
          setResults(profile ? [profile] : []);
          return;
        }
        const mediaData = await searchMedia(q);
        const filteredMedia =
          type === 'all' ? mediaData : mediaData.filter((item) => item.media_type === type);
        if (type === 'all') {
          const profile = await searchProfileByUsername(q);
          const combined = profile ? [profile, ...filteredMedia] : filteredMedia;
          setResults(combined);
        } else {
          setResults(filteredMedia);
        }
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
    <>
    {modalMedia && (
      <AddToListModal
        mediaId={modalMedia.id}
        mediaType={modalMedia.type}
        onClose={handleModalClose}
      />
    )}
    <div className={styles.searchSection}>
      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search movies, shows, or usernames"
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
            {FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className={selectedType === value ? styles.chipSelected : styles.chip}
                onClick={() => handleChip(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.resultsContainer}>
          {results === null ? (
            <div className={styles.emptyState}>
              <Image
                src={publicAssetPath('/images/Rabbit.svg')}
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
              if (item.type === 'profile') {
                const fullName = `${item.firstname || ''} ${item.lastname || ''}`.trim() || 'Unnamed';
                return (
                  <Link
                    key={`profile-${item.uid}`}
                    href={`/user?uid=${item.uid}`}
                    className={styles.profileCard}
                  >
                    <div className={styles.profileCardAvatar}>
                      <div className={styles.profileCardAvatarCircle}>
                        {item.photoURL ? (
                          <Image src={item.photoURL} alt="" width={160} height={160} className={styles.profileCardImg} />
                        ) : (
                          <span className={styles.profileCardInitials}>
                            {fullName ? `${fullName.split(' ')[0][0]}${fullName.split(' ')[1]?.[0] || ''}`.toUpperCase() : '?'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.profileCardInfo}>
                      <span className={styles.profileCardName}>{fullName}</span>
                      {item.username && <span className={styles.profileCardUsername}>@{item.username}</span>}
                    </div>
                  </Link>
                );
              }
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
                  onAddToList={(id, type) => setModalMedia({ id, type })}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
    </>
  );
}
