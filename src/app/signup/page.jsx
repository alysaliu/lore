'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '../../lib/firebase';
import { publicAssetPath } from '../../lib/publicPath';
import { navigateAfterAuth } from '../../lib/navigateAfterAuth';
import { getFirebaseAuthErrorMessage } from '../../lib/firebaseAuthErrors';
import PasswordSecurityHint from '../../components/PasswordSecurityHint';
import styles from '../login/page.module.css';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  /** null | 'email' | 'google' — only that control shows a loading label */
  const [pending, setPending] = useState(null);

  const busy = pending !== null;
  const canSubmit = auth && db && email.trim() && password.length >= 6;

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }
    setPending('email');
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await navigateAfterAuth(router, user);
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err.code));
    } finally {
      setPending(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setPending('google');
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      await navigateAfterAuth(router, user);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getFirebaseAuthErrorMessage(err.code) || err.message);
      }
    } finally {
      setPending(null);
    }
  };

  if (!auth || !db) {
    return (
      <div className={styles.formSection}>
        <p className={styles.error}>Sign up is unavailable. Check your configuration.</p>
      </div>
    );
  }

  return (
    <div className={styles.formSection}>
      <div className={styles.title}>
        <h1>Create your account</h1>
        <h3>Join Lore</h3>
      </div>

      <Image
        src={publicAssetPath('/images/Rabbit.svg')}
        alt="Lore"
        width={60}
        height={60}
        className={styles.logo}
      />

      <form className={styles.form} onSubmit={handleEmailSignup} noValidate>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        <PasswordSecurityHint>
          <div className={styles.inputWrapper}>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              minLength={6}
            />
          </div>
        </PasswordSecurityHint>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
            required
            minLength={6}
          />
        </div>
        <button type="submit" className={styles.submitBtn} disabled={busy || !canSubmit}>
          {pending === 'email' ? 'Creating account...' : 'Sign up with email'}
        </button>

        <p className={styles.orText}>or</p>

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleSignIn}
          disabled={busy}
        >
          <svg className={styles.googleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {pending === 'google' ? 'Please wait...' : 'Continue with Google'}
        </button>

        <p className={styles.formFooter}>
          Already have an account?{' '}
          <Link href="/login" className={styles.textLink}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
