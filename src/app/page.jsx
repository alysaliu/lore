'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import styles from './page.module.css';
import { getPopularMedia, getPosterUrl } from '../lib/tmdb';

const INITIAL_POSITIONS = [
  { x: 60,   y: 300, rotation: -12 },
  { x: 240,  y: 410, rotation:   8 },
  { x: 140,  y: 530, rotation: -18 },
  { x: 380,  y: 340, rotation:   6 },
  { x: 480,  y: 490, rotation: -9  },
  { x: 620,  y: 360, rotation:  14 },
  { x: 700,  y: 520, rotation:  -5 },
  { x: 840,  y: 310, rotation:  10 },
  { x: 920,  y: 470, rotation: -15 },
  { x: 1040, y: 380, rotation:   7 },
  { x: 1100, y: 540, rotation: -11 },
  { x: 1180, y: 290, rotation:  16 },
  { x: 330,  y: 610, rotation:  -7 },
  { x: 780,  y: 630, rotation:  12 },
];

export default function HomePage() {
  const [posters, setPosters] = useState([]);
  const [zIndices, setZIndices] = useState(() => INITIAL_POSITIONS.map(() => 2));
  const [topZ, setTopZ] = useState(2);
  const containerRef = useRef(null);

  useEffect(() => {
    getPopularMedia().then((media) => {
      setPosters(media.slice(0, 14));
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
          <span>Rank movies and shows with friends.*</span>
          <span>All in one place.</span>
          <span>No ads.</span>
        </h1>
        <Link href="/signup" className={styles.signupButton}>
          Sign up now
        </Link>
        <p className={styles.footnote}>*and then drag them for their hot takes. Sorry, who said that?</p>
      </div>

      <div className={styles.backgroundCard} />

      <div className={styles.posterScatter} ref={containerRef}>
        {posters.map((item, i) => {
          const pos = INITIAL_POSITIONS[i];
          if (!pos) return null;
          return (
            <motion.div
              key={item.id}
              className={styles.posterCard}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: zIndices[i],
              }}
              initial={{ rotate: pos.rotation }}
              drag
              dragConstraints={containerRef}
              dragElastic={0.05}
              dragMomentum={false}
              whileHover={{ scale: 1.05, y: -6 }}
              whileDrag={{ scale: 1.08, boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
              onDragStart={() => bringToFront(i)}
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
        })}
      </div>
    </main>
  );
}
