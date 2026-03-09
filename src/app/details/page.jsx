'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { fetchMediaDetails, fetchMediaName, getPosterUrl } from '../../lib/tmdb';
import styles from './page.module.css';

const SCORE_RANGES = {
  'not-good': [1, 3],
  'okay': [4, 6],
  'good': [7, 8],
  'amazing': [9, 10],
};


function DetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const mediaType = searchParams.get('media_type');

  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState(null);
  const [bgGradient, setBgGradient] = useState(null);

  // Watchlist
  const [inWatchlist, setInWatchlist] = useState(false);

  // Rating state machine: 'season' (TV only) | 'initial' | 'comparing' | 'done'
  const [ratingPhase, setRatingPhase] = useState('initial');
  const [selectedSeason, setSelectedSeason] = useState(null); // null = whole show
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [note, setNote] = useState('');
  const [comparisonGroup, setComparisonGroup] = useState([]);
  const [insertionState, setInsertionState] = useState(null); // { low, high, mid }
  const [compareTitle, setCompareTitle] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [finalScore, setFinalScore] = useState(null);
  const [, setExistingRating] = useState(null);
  const [existingSentiment, setExistingSentiment] = useState(null);
  const [isReranking, setIsReranking] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [userRatings, setUserRatings] = useState(null);
  const [existingShowRatings, setExistingShowRatings] = useState([]);
  const [showRatingForm, setShowRatingForm] = useState(false);

  // Load media details
  useEffect(() => {
    if (!id || !mediaType) return;
    const timer = setTimeout(async () => {
      try {
        const data = await fetchMediaDetails(mediaType, id);
        setMedia(data);
        setCurrentTitle(mediaType === 'movie' ? data.title : data.name);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [id, mediaType]);

  // Check auth state & watchlist / existing rating
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user || !id || !mediaType) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;
        const data = snap.data();

        // Watchlist
        const watchlist = data.lists?.watchlist || [];
        setInWatchlist(watchlist.some((item) => item.mediaId === id));

        // Existing rating
        const ratings = data.ratings || {};
        setUserRatings(ratings);
        refreshShowRatings(ratings);
        if (mediaType === 'movie') {
          for (const sentiment in ratings[mediaType] || {}) {
            for (const entry of ratings[mediaType][sentiment]) {
              if (entry.mediaId === id) {
                setExistingRating(entry);
                setExistingSentiment(sentiment);
                setRatingPhase('done');
                setFinalScore(entry.score);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
    return () => unsubscribe();
  }, [id, mediaType]);

  // Extract dominant colors from poster for background gradient
  useEffect(() => {
    if (!media?.poster_path) return;

    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = getPosterUrl(media.poster_path, 'w92');

    img.onload = () => {
      const W = 10, H = 15;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const pixels = ctx.getImageData(0, 0, W, H).data;

      // Pick the most saturated pixel from the top half (left glow) and bottom half (right glow)
      const saturation = (r, g, b) => {
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        return max === 0 ? 0 : (max - min) / max;
      };

      let r1 = 0, g1 = 0, b1 = 0, sat1 = -1;
      let r3 = 0, g3 = 0, b3 = 0, sat3 = -1;
      const halfH = Math.floor(H / 2);

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          const s = saturation(r, g, b);
          if (y < halfH) {
            if (s > sat1) { sat1 = s; r1 = r; g1 = g; b1 = b; }
          } else {
            if (s > sat3) { sat3 = s; r3 = r; g3 = g; b3 = b; }
          }
        }
      }

      setBgGradient(
        `radial-gradient(ellipse 70% 60% at 10% 0%, rgba(${r1},${g1},${b1},0.25) 0%, rgba(${r1},${g1},${b1},0.1) 50%, transparent 100%),` +
        `radial-gradient(ellipse 70% 60% at 90% 0%, rgba(${r3},${g3},${b3},0.18) 0%, transparent 100%)`
      );
    };
  }, [media?.poster_path]);

  const handleWatchlist = async () => {
    const user = auth.currentUser;
    if (!user) { alert('Please log in to use your watchlist.'); return; }
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    const lists = data.lists || {};
    const watchlist = lists.watchlist || [];

    if (inWatchlist) {
      const updated = watchlist.filter((item) => item.mediaId !== id);
      await setDoc(userRef, { lists: { ...lists, watchlist: updated } }, { merge: true });
      setInWatchlist(false);
    } else {
      const updated = [...watchlist, { mediaId: id, mediaType, timestamp: new Date().toISOString() }];
      await setDoc(userRef, { lists: { ...lists, watchlist: updated } }, { merge: true });
      setInWatchlist(true);
    }
  };

  const handleNext = async () => {
    if (!selectedSentiment) { alert('Please select a rating!'); return; }
    const user = auth.currentUser;
    if (!user) { alert('Please log in to rate'); return; }

    const ratingsRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(ratingsRef);
    let ratings = userDoc.exists() ? userDoc.data().ratings || {} : {};

    if (!ratings[mediaType]) ratings[mediaType] = {};
    if (!ratings[mediaType][selectedSentiment]) ratings[mediaType][selectedSentiment] = [];

    const matchesCurrent = (item) => item.mediaId === id && (item.season ?? null) === (selectedSeason ?? null);

    const group = (ratings[mediaType][selectedSentiment] || []).filter(item => !matchesCurrent(item));

    if (group.length === 0) {
      const [, max] = SCORE_RANGES[selectedSentiment];
      const newRating = { mediaId: id, mediaType, note: note || null, score: max, timestamp: new Date().toISOString(), ...(selectedSeason != null && { season: selectedSeason }) };
      // Remove from all other sentiment groups before saving
      for (const sentiment of Object.keys(ratings[mediaType])) {
        if (sentiment === selectedSentiment) continue;
        const cleaned = (ratings[mediaType][sentiment] || []).filter(item => !matchesCurrent(item));
        if (cleaned.length !== (ratings[mediaType][sentiment] || []).length) {
          const [sMin, sMax] = SCORE_RANGES[sentiment] || [1, 10];
          for (let i = 0; i < cleaned.length; i++) {
            const ratio = i / (cleaned.length - 1 || 1);
            cleaned[i].score = Math.round((sMax - (sMax - sMin) * ratio) * 10) / 10;
          }
          ratings[mediaType][sentiment] = cleaned;
        }
      }
      ratings[mediaType][selectedSentiment] = [newRating];
      await setDoc(ratingsRef, { ratings }, { merge: true });
      if (!isReranking) await incrementRatingCount(user.uid);
      refreshShowRatings(ratings);
      if (mediaType === 'tv') {
        setSelectedSentiment(null);
        setSelectedSeason(null);
        setNote('');
        setIsReranking(false);
        setRatingPhase('initial');
        setShowRatingForm(false);
      } else {
        setFinalScore(max);
        setRatingPhase('done');
      }
      return;
    }

    // Start binary insertion
    setComparisonGroup(group);
    const initState = { low: 0, high: group.length - 1, mid: Math.floor((0 + group.length - 1) / 2) };
    setInsertionState(initState);

    const compareEntry0 = group[initState.mid];
    const compareName0 = await fetchMediaName(compareEntry0.mediaId, compareEntry0.mediaType || mediaType);
    setCompareTitle(compareEntry0.season != null ? `${compareName0} (Season ${compareEntry0.season})` : (compareName0 || '?'));
    setRatingPhase('comparing');
  };

  const handleComparison = async (prefersCurrent) => {
    const { low, high, mid } = insertionState;
    let newLow = low;
    let newHigh = high;

    if (prefersCurrent) {
      newHigh = mid - 1;
    } else {
      newLow = mid + 1;
    }

    if (newLow > newHigh) {
      // Insert at newLow position
      await saveWithInsertion(newLow);
    } else {
      const newMid = Math.floor((newLow + newHigh) / 2);
      setInsertionState({ low: newLow, high: newHigh, mid: newMid });
      const compareEntry = comparisonGroup[newMid];
      const compareName = await fetchMediaName(compareEntry.mediaId, compareEntry.mediaType || mediaType);
      setCompareTitle(compareEntry.season != null ? `${compareName} (Season ${compareEntry.season})` : (compareName || '?'));
    }
  };

  const handleSkip = async () => {
    await saveWithInsertion(insertionState?.low ?? comparisonGroup.length);
  };

  const saveWithInsertion = async (position) => {
    const user = auth.currentUser;
    const ratingsRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(ratingsRef);
    const ratings = userDoc.exists() ? userDoc.data().ratings || {} : {};

    if (!ratings[mediaType]) ratings[mediaType] = {};

    const matchesCurrent = (item) => item.mediaId === id && (item.season ?? null) === (selectedSeason ?? null);

    // Remove current item from every sentiment group and recalculate their scores
    for (const sentiment of Object.keys(ratings[mediaType])) {
      if (sentiment === selectedSentiment) continue;
      const cleaned = (ratings[mediaType][sentiment] || []).filter(item => !matchesCurrent(item));
      if (cleaned.length !== (ratings[mediaType][sentiment] || []).length) {
        const [sMin, sMax] = SCORE_RANGES[sentiment] || [1, 10];
        for (let i = 0; i < cleaned.length; i++) {
          const ratio = i / (cleaned.length - 1 || 1);
          cleaned[i].score = Math.round((sMax - (sMax - sMin) * ratio) * 10) / 10;
        }
        ratings[mediaType][sentiment] = cleaned;
      }
    }

    // Build target group, excluding current item
    const group = [...(ratings[mediaType][selectedSentiment] || [])].filter(item => !matchesCurrent(item));
    const [min, max] = SCORE_RANGES[selectedSentiment];

    group.splice(position, 0, {
      mediaId: id,
      mediaType,
      note: note || null,
      score: 0,
      timestamp: new Date().toISOString(),
      ...(selectedSeason != null && { season: selectedSeason }),
    });

    for (let i = 0; i < group.length; i++) {
      const ratio = i / (group.length - 1 || 1);
      group[i].score = Math.round((max - (max - min) * ratio) * 10) / 10;
    }

    ratings[mediaType][selectedSentiment] = group;
    await updateDoc(ratingsRef, { ratings });
    if (!isReranking) await incrementRatingCount(user.uid);
    refreshShowRatings(ratings);

    if (mediaType === 'tv') {
      setSelectedSentiment(null);
      setSelectedSeason(null);
      setNote('');
      setIsReranking(false);
      setInsertionState(null);
      setRatingPhase('initial');
      setShowRatingForm(false);
    } else {
      setFinalScore(group[position].score);
      setExistingSentiment(selectedSentiment);
      setIsReranking(false);
      setRatingPhase('done');
      setInsertionState(null);
    }
    setInsertionState(null);
  };

  const refreshShowRatings = (ratings) => {
    const all = [];
    for (const sentiment in ratings[mediaType] || {}) {
      for (const entry of ratings[mediaType][sentiment]) {
        if (entry.mediaId === id) {
          all.push({ season: entry.season ?? null, score: entry.score });
        }
      }
    }
    setExistingShowRatings(all.sort((a, b) => (a.season ?? Infinity) - (b.season ?? Infinity)));
  };

  const handleRerankSeason = (season) => {
    setSelectedSeason(season);
    setSelectedSentiment(null);
    setNote('');
    setIsReranking(true);
    setRatingPhase('initial');
    setShowRatingForm(true);
  };

  const handleSeasonSelect = (season) => {
    setSelectedSeason(season);
    setSelectedSentiment(null);
  };

  const handleRerank = () => {
    setRatingPhase('initial');
    setSelectedSeason(null);
    setSelectedSentiment(null);
    setNote('');
    setIsReranking(true);
  };

  const incrementRatingCount = async (uid) => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    const current = snap.exists() && snap.data().ratingCount ? snap.data().ratingCount : 0;
    await updateDoc(userRef, { ratingCount: current + 1 });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Image src="/images/jumpingin.gif" alt="Loading" width={300} height={300} unoptimized />
        Hold tight, we're sniffing around for the right content...
      </div>
    );
  }

  if (!media) return null;

  const posterUrl = getPosterUrl(media.poster_path, 'w500');
  const year = (media.release_date || media.first_air_date || '').split('-')[0];
  const displayType = mediaType === 'movie' ? 'movie' : 'show';

  const runtimeMins = media.runtime || media.episode_run_time?.[0];
  const runtime = runtimeMins ? `${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m` : null;

  const director = (media.credits?.crew || []).find((c) => c.job === 'Director')?.name;
  const cast = (media.credits?.cast || []).slice(0, 3).map((c) => c.name).join(', ');

  return (
    <div className={styles.mainContent} style={bgGradient ? { background: `${bgGradient}, var(--color-surface-default)` } : {}}>

      <div className={styles.content}>
        <div className={styles.headerContainer}>
          <div className={styles.posterCard}>
            <img src={posterUrl} alt={currentTitle} className={styles.posterCardImage} />
            <button
              className={`${styles.watchlistIconBtn} ${inWatchlist ? styles.watchlistIconBtnActive : ''}`}
              onClick={handleWatchlist}
              data-tooltip={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <i className={`fas fa-${inWatchlist ? 'check' : 'plus'}`}></i>
            </button>
          </div>

          <div className={styles.info}>
            <div className={styles.title}>{currentTitle}</div>
            <div className={styles.metaRow}>
              {year && <span className={styles.metaItem}>{year}</span>}
              {runtime && <><span className={styles.metaDot}>·</span><span className={styles.metaItem}>{runtime}</span></>}
              {(media.genres || []).length > 0 && <span className={styles.metaDot}>·</span>}
              {(media.genres || []).map((g) => (
                <span key={g.id} className={styles.genreBadge}>{g.name}</span>
              ))}
            </div>
            <div className={styles.description}>{media.overview}</div>
            {(director || cast) && (
              <div className={styles.creditsLine}>
                {director && <><span className={styles.creditsLabel}>Dir.</span><span className={styles.creditsValue}>{director}</span></>}
                {director && cast && <span className={styles.metaDot}>·</span>}
                {cast && <><span className={styles.creditsLabel}>Starring</span><span className={styles.creditsValue}>{cast}</span></>}
              </div>
            )}

            <hr className={styles.divider} />

            {/* Rating box */}
            <div className={styles.ratingBox}>
          {mediaType === 'tv' && existingShowRatings.length > 0 && (
            <div className={styles.existingRatings}>
              <span className="eyebrow">Your ratings</span>
              {existingShowRatings.map((r) => (
                <div key={r.season ?? 'show'} className={styles.existingRatingRow}>
                  <span className={styles.existingRatingLabel}>
                    {r.season != null ? `Season ${r.season}` : 'Whole show'}
                  </span>
                  <span className={styles.existingRatingScore}>{r.score}</span>
                  <button className={styles.rerankBtn} onClick={() => handleRerankSeason(r.season)}>
                    Re-rank
                  </button>
                </div>
              ))}
            </div>
          )}
          {mediaType === 'tv' && existingShowRatings.length > 0 && !showRatingForm && !cancelled && ratingPhase !== 'comparing' && (
            <button className={styles.rateAnotherBtn} onClick={() => setShowRatingForm(true)}>
              Rate another season
            </button>
          )}
          {cancelled ? (
            <p className={styles.resultText}>Ok! Come back when you've watched it.</p>
          ) : ratingPhase === 'done' && mediaType !== 'tv' ? (
            <div className={styles.ratingDone}>
              <div className={styles.ratingColumn}>
                <div className="eyebrow">Your rating{selectedSeason != null ? ` · Season ${selectedSeason}` : ''}</div>
                <div className={styles.ratingColumnScore}>{finalScore}</div>
                <button className={styles.rerankBtn} onClick={handleRerank}>Re-rank</button>
              </div>
            </div>
          ) : ratingPhase === 'comparing' ? (
            <>
              <h3>Which did you like more?</h3>
              <div className={styles.comparisonButtons}>
                <button className={styles.compareBtn} onClick={() => handleComparison(true)}>
                  {selectedSeason != null ? `${currentTitle} (Season ${selectedSeason})` : currentTitle}
                </button>
                <button className={styles.compareBtn} onClick={() => handleComparison(false)}>
                  {compareTitle}
                </button>
              </div>
              <button className={styles.skipLink} onClick={handleSkip}>
                Too tough, skip
              </button>
            </>
          ) : (mediaType === 'tv' && existingShowRatings.length > 0 && !showRatingForm) ? null : (
            <>
              {mediaType === 'tv' ? (
                <div className={styles.seasonDropdownRow}>
                  How would you rate{' '}
                  <span className={styles.seasonDropdownWrapper}>
                    <span className={styles.seasonDropdownSizer}>
                      <select
                        className={styles.seasonDropdown}
                        value={selectedSeason ?? 'whole'}
                        onChange={(e) => handleSeasonSelect(e.target.value === 'whole' ? null : Number(e.target.value))}
                      >
                        <option value="whole">all</option>
                        {(media?.seasons || []).filter(s => s.season_number > 0).map(s => (
                          <option key={s.season_number} value={s.season_number}>Season {s.season_number}</option>
                        ))}
                      </select>
                      <span aria-hidden="true">
                        {selectedSeason != null ? `Season ${selectedSeason}` : 'all'}
                      </span>
                    </span>
                    <i className={`fas fa-chevron-down ${styles.seasonDropdownIcon}`}></i>
                  </span>
                  {' '}of {currentTitle}?
                </div>
              ) : (
                <h3>How would you rate this {displayType}?</h3>
              )}
              <div className={styles.ratingOptions}>
                {[
                  { value: 'not-good', label: 'Not good', emoji: '😒' },
                  { value: 'okay', label: 'Okay', emoji: '😐' },
                  { value: 'good', label: 'Good', emoji: '😊' },
                  { value: 'amazing', label: 'Amazing', emoji: '😍' },
                ].map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    className={selectedSentiment === value ? styles.ratingButtonSelected : styles.ratingButton}
                    onClick={() => setSelectedSentiment(value)}
                  >
                    <span className={styles.ratingLabel}>{label}</span>
                    <span className={styles.ratingEmoji}>{emoji}</span>
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Leave an optional note for your review"
                className={styles.noteInput}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className={styles.buttonRow}>
                {mediaType === 'tv' && existingShowRatings.length > 0 && (
                  <button className={styles.cancelBtn} onClick={() => setShowRatingForm(false)}>
                    Cancel
                  </button>
                )}
                <button
                  className={styles.nextBtn}
                  onClick={handleNext}
                  disabled={!(mediaType === 'tv' && existingShowRatings.length > 0) && !selectedSentiment}
                >
                  Next
                </button>
              </div>
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-text-secondary)' }}>
        Loading...
      </div>
    }>
      <DetailsContent />
    </Suspense>
  );
}
