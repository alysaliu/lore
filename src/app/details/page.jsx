'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
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

  // Rating state machine: 'initial' | 'comparing' | 'done'
  const [ratingPhase, setRatingPhase] = useState('initial');
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [note, setNote] = useState('');
  const [comparisonGroup, setComparisonGroup] = useState([]);
  const [insertionState, setInsertionState] = useState(null); // { low, high, mid }
  const [compareTitle, setCompareTitle] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [finalScore, setFinalScore] = useState(null);
  const [existingRating, setExistingRating] = useState(null);
  const [cancelled, setCancelled] = useState(false);

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
        for (const sentiment in ratings[mediaType] || {}) {
          for (const entry of ratings[mediaType][sentiment]) {
            if (entry.mediaId === id) {
              setExistingRating(entry);
              setRatingPhase('done');
              setFinalScore(entry.score);
              return;
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
        `radial-gradient(ellipse 70% 60% at 10% 0%, rgba(${r1},${g1},${b1},0.9) 0%, rgba(${r1},${g1},${b1},0.4) 50%, transparent 100%),` +
        `radial-gradient(ellipse 70% 60% at 90% 0%, rgba(${r3},${g3},${b3},0.7) 0%, transparent 100%)`
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

    const group = ratings[mediaType][selectedSentiment];

    if (group.length === 0) {
      const [, max] = SCORE_RANGES[selectedSentiment];
      const newRating = { mediaId: id, mediaType, note: note || null, score: max, timestamp: new Date().toISOString() };
      ratings[mediaType][selectedSentiment] = [newRating];
      await setDoc(ratingsRef, { ratings }, { merge: true });
      await incrementRatingCount(user.uid);
      setFinalScore(max);
      setRatingPhase('done');
      return;
    }

    // Start binary insertion
    setComparisonGroup(group);
    const initState = { low: 0, high: group.length - 1, mid: Math.floor((0 + group.length - 1) / 2) };
    setInsertionState(initState);

    const compareName = await fetchMediaName(group[initState.mid].mediaId, group[initState.mid].mediaType || mediaType);
    setCompareTitle(compareName || '?');
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
      const compareName = await fetchMediaName(comparisonGroup[newMid].mediaId, comparisonGroup[newMid].mediaType || mediaType);
      setCompareTitle(compareName || '?');
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

    const group = [...(ratings[mediaType]?.[selectedSentiment] || [])];
    const [min, max] = SCORE_RANGES[selectedSentiment];

    group.splice(position, 0, {
      mediaId: id,
      mediaType,
      note: note || null,
      score: 0,
      timestamp: new Date().toISOString(),
    });

    for (let i = 0; i < group.length; i++) {
      const ratio = i / (group.length - 1 || 1);
      group[i].score = Math.round((max - (max - min) * ratio) * 10) / 10;
    }

    if (!ratings[mediaType]) ratings[mediaType] = {};
    ratings[mediaType][selectedSentiment] = group;
    await updateDoc(ratingsRef, { ratings });
    await incrementRatingCount(user.uid);

    setFinalScore(group[position].score);
    setRatingPhase('done');
    setInsertionState(null);
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
          </div>

          <div className={styles.info}>
            <div className={styles.title}>{currentTitle}</div>
            <div className={styles.metaRow}>
              {year && <span className={styles.metaItem}>{year}</span>}
              {runtime && <><span className={styles.metaDot}>·</span><span className={styles.metaItem}>{runtime}</span></>}
            </div>
            <div className={styles.genres}>
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
            <button className={styles.btn} onClick={handleWatchlist}>
              <i className={`fas fa-${inWatchlist ? 'check' : 'plus'}`}></i>
              {inWatchlist ? 'Added to watchlist' : 'Add to watchlist'}
            </button>
          </div>
        </div>

        {/* Rating box */}
        <div className={styles.ratingBox}>
          {cancelled ? (
            <p className={styles.resultText}>Ok! Come back when you've watched it.</p>
          ) : ratingPhase === 'done' ? (
            <p className={styles.resultText}>
              {existingRating
                ? `Your rating: ${finalScore}`
                : `Thanks! You rated this a ${finalScore}.`}
            </p>
          ) : ratingPhase === 'comparing' ? (
            <>
              <h3>Which did you like more?</h3>
              <div className={styles.comparisonButtons}>
                <button className={styles.compareBtn} onClick={() => handleComparison(true)}>
                  {currentTitle}
                </button>
                <button className={styles.compareBtn} onClick={() => handleComparison(false)}>
                  {compareTitle}
                </button>
              </div>
              <button className={styles.skipLink} onClick={handleSkip}>
                Too tough, skip
              </button>
            </>
          ) : (
            <>
              <h3>How would you rate this {displayType}?</h3>
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
                <button className={styles.cancelBtn} onClick={() => setCancelled(true)}>
                  I haven't watched it yet
                </button>
                <button className={styles.nextBtn} onClick={handleNext}>
                  Next
                </button>
              </div>
            </>
          )}
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
