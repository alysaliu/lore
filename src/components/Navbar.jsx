'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, initials } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <Link href="/" className={styles.navbarLogo}>
          <Image src="/images/Rabbit.svg" alt="Lore" width={40} height={40} className={styles.logo} />
        </Link>

        <div
          className={`${styles.navbarToggle} ${menuOpen ? styles.isActive : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
        </div>

        <ul className={`${styles.navbarMenu} ${menuOpen ? styles.active : ''}`}>
          <li className={styles.navbarItem}>
            <Link href="/" className={styles.navbarLinks}>Home</Link>
          </li>
          <li className={styles.navbarItem}>
            <Link href="/explore" className={styles.navbarLinks}>Search</Link>
          </li>
          <div className={styles.navRight}>
            {user ? (
              <Link href="/profile" className={styles.profileCircle}>
                {initials}
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.signupNavBtn}>Sign in</Link>
              </>
            )}
          </div>
        </ul>
      </div>
    </nav>
  );
}
