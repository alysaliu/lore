'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { publicAssetPath } from '../lib/publicPath';
import styles from './page.module.css';

const slides = [
  { image: publicAssetPath('/images/Littlewomen.svg') },
  { image: publicAssetPath('/images/Moonlightkingdom.svg') },
  { image: publicAssetPath('/images/Severance.svg') },
];

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className={styles.main}>
      <div
        className={styles.slideshowContainer}
        style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
      >
        <div className={styles.mainContainer}>
          <div className={styles.mainContent}>
            <h1>Lore</h1>
            <p>Experience TV shows and movies with friends</p>
          </div>

          <div className={styles.services}>
            <div className={styles.servicesContainer}>
              <div className={styles.servicesCard}>
                <h2>📺 Rate movies and shows</h2>
                <p>All your watching history in one place, stack-ranked against each other</p>
                <Link href="/login" className={styles.buttonLink}>Sign up</Link>
              </div>
              <div className={styles.servicesCard}>
                <h2>👯‍♀️ Connect with friends</h2>
                <p>View friends&apos; profiles and see Lore&apos;s out-of-pocket take on their taste</p>
                <Link href="/login" className={styles.buttonLink}>Sign up</Link>
              </div>
              <div className={styles.servicesCard}>
                <h2>📢 Share your feedback</h2>
                <p>Have feature ideas or bugs to share? We&apos;d love to hear it!</p>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSeSrXgl4tIrnMrwtHWfDLWmysxrcwl7JYetKZ5gydKJIqbqWw/viewform?usp=header"
                  className={styles.buttonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Feedback form
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
