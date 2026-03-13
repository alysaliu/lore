'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import styles from './page.module.css';

const SECTIONS = [
  { id: 'account', label: 'Account' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('account');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return null;
  if (!user) return null;

  return (
    <div className={styles.settingsSection}>
      <div className={styles.settingsContainer}>
        <nav className={styles.sidebar} aria-label="Settings sections">
          <ul className={styles.sidebarList}>
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  className={`${styles.sidebarTab} ${activeSection === id ? styles.sidebarTabActive : ''}`}
                  onClick={() => setActiveSection(id)}
                  aria-current={activeSection === id ? 'true' : undefined}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.content}>
          {activeSection === 'account' && (
            <section className={styles.panel} aria-labelledby="account-heading">
              <h2 id="account-heading" className={styles.panelTitle}>Account</h2>
              <p className={styles.panelDescription}>
                Manage your account and sign-in options.
              </p>
              <div className={styles.panelBody}>
                <div className={styles.settingBlock}>
                  <h3 className={styles.settingBlockTitle}>Import</h3>
                  <p className={styles.settingBlockDescription}>
                    Bring your ratings and watch history from Letterboxd.
                  </p>
                  <button type="button" className={styles.primaryBtn}>
                    Import from Letterboxd
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
