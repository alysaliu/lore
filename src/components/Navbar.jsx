'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const router = useRouter();
  const { user, initials, photoURL, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

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
              <div
                className={styles.userMenuWrapper}
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  type="button"
                  className={styles.profileCircle}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  aria-label="User menu"
                >
                  {photoURL
                    ? <Image src={photoURL} alt="Profile" className={styles.profileCircleImg} width={36} height={36} />
                    : initials
                  }
                </button>
                {userMenuOpen && (
                  <div className={styles.userDropdown} role="menu">
                    <Link href="/profile" className={styles.userDropdownItem} role="menuitem">
                      Profile
                    </Link>
                    <Link href="/settings" className={styles.userDropdownItem} role="menuitem">
                      Settings
                    </Link>
                    <button
                      type="button"
                      className={`${styles.userDropdownItem} ${styles.userDropdownItemLogout}`}
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
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
