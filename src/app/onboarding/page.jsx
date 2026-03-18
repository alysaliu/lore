'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { publicAssetPath } from '../../lib/publicPath';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../login/page.module.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = username.trim().toLowerCase();

    if (!USERNAME_RE.test(trimmed)) {
      setError('Please use 3–20 characters, letters, numbers, and underscores only.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const usernameRef = doc(db, 'usernames', trimmed);
      const usernameSnap = await getDoc(usernameRef);

      if (usernameSnap.exists()) {
        setError('That username is already taken.');
        setSaving(false);
        return;
      }

      const nameParts = (user.displayName || '').split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';

      await setDoc(usernameRef, { uid: user.uid });
      await setDoc(doc(db, 'users', user.uid), {
        firstname,
        lastname,
        email: user.email || null,
        photoURL: user.photoURL || null,
        username: trimmed,
        isDeveloper: false,
        createdAt: serverTimestamp(),
        lists: { watchlist: [] },
      });

      router.push('/explore');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className={styles.formSection}>
      <div className={styles.title}>
        <h1>Pick a username</h1>
        <h3>This is how others will find you on Lore</h3>
      </div>

      <Image src={publicAssetPath('/images/Rabbit.svg')} alt="Lore" width={60} height={60} className={styles.logo} />

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.inputWrapper}>
          <span className={styles.inputIconLeft}>@</span>
          <input
            className={styles.inputWithPrefix}
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button className={styles.submitBtn} type="submit" disabled={saving || !username.trim()}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
