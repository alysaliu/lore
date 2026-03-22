'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useMotionValue } from 'framer-motion';
import { collection, getCountFromServer } from 'firebase/firestore';
import styles from './page.module.css';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getPopularMedia, getPosterUrl } from '../lib/tmdb';

// Positions as fractions of viewport width/height
const INITIAL_POSITIONS = [
  { xPct: 0.19, yPct: 0.38, rotation: -12 },
  { xPct: 0.28, yPct: 0.48, rotation:   8 },
  { xPct: 0.23, yPct: 0.59, rotation: -18 },
  { xPct: 0.35, yPct: 0.42, rotation:   6 },
  { xPct: 0.40, yPct: 0.55, rotation:  -9 },
  { xPct: 0.46, yPct: 0.43, rotation:  14 },
  { xPct: 0.50, yPct: 0.58, rotation:  -5 },
  { xPct: 0.57, yPct: 0.39, rotation:  10 },
  { xPct: 0.61, yPct: 0.53, rotation: -15 },
  { xPct: 0.66, yPct: 0.45, rotation:   7 },
  { xPct: 0.69, yPct: 0.60, rotation: -11 },
  { xPct: 0.73, yPct: 0.37, rotation:  16 },
  { xPct: 0.32, yPct: 0.66, rotation:  -7 },
  { xPct: 0.54, yPct: 0.68, rotation:  12 },
];

function PosterCard({ item, initialX, initialY, rotation, zIndex, onDragStart }) {
  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);

  return (
    <motion.div
      className={styles.posterCard}
      style={{ x, y, rotate: rotation, zIndex, position: 'absolute', top: 0, left: 0 }}
      drag
      dragMomentum={false}
      dragElastic={0}
      whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
      onDragStart={onDragStart}
    >
      <Image
        src={getPosterUrl(item.poster_path, 'w342')}
        alt={item.title || item.name}
        width={160}
        height={240}
        draggable={false}
      />
    </motion.div>
  );
}

export default function HomePage() {
  const [posters, setPosters] = useState([]);
  const [zIndices, setZIndices] = useState(() => INITIAL_POSITIONS.map(() => 2));
  const [topZ, setTopZ] = useState(2);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [userCount, setUserCount] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    function update() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    getPopularMedia().then((media) => {
      setPosters(media.slice(0, 14));
    });
  }, []);

  useEffect(() => {
    if (!db) return;
    getCountFromServer(collection(db, 'users')).then((snap) => {
      setUserCount(snap.data().count);
    });
  }, []);

  function bringToFront(index) {
    const next = topZ + 1;
    setTopZ(next);
    setZIndices((prev) => prev.map((z, i) => (i === index ? next : z)));
  }

  return (
    <main className={styles.page}>
      <div className={styles.heroContent}>
        <h1 className={styles.heading}>
          Rank movies and shows<br />with friends.<span className={styles.asterisk}>*</span>
        </h1>
        <p className={styles.subtext}>All in one place.&nbsp;&nbsp;No ads.</p>
        <Link href={user ? '/profile' : '/signup'} className={styles.signupButton}>
          {user ? 'Go to profile' : 'Start ranking free'} <span aria-hidden="true">→</span>
        </Link>
        <p className={styles.socialProof}>
          {userCount !== null && <><strong>{userCount.toLocaleString()}</strong> fans already ranking</>}
        </p>
        <p className={styles.footnote}>
          <span className={styles.asterisk}>*</span> and then drag them for their hot takes. Sorry, who said that?
        </p>
      </div>

      <div className={styles.backgroundCard} />

      <div className={styles.posterScatter}>
        {windowSize.width > 0 && posters.map((item, i) => {
          const pos = INITIAL_POSITIONS[i];
          if (!pos) return null;
          return (
            <PosterCard
              key={item.id}
              item={item}
              initialX={pos.xPct * windowSize.width}
              initialY={pos.yPct * windowSize.height + 50}
              rotation={pos.rotation}
              zIndex={zIndices[i]}
              onDragStart={() => bringToFront(i)}
            />
          );
        })}
      </div>
    </main>
  );
}
