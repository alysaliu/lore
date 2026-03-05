'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/explore');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.title}>
        <h1>Welcome back to Lore</h1>
        <h3>Dive into the rabbithole</h3>
      </div>

      <Image
        src="/images/Rabbit.svg"
        alt="Lore"
        width={60}
        height={60}
        className={styles.logo}
      />

      <form id="login-form" className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputWrapper}>
          <input
            type="email"
            className={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <span className={styles.inputIcon}>
            <i className="fas fa-envelope"></i>
          </span>
        </div>

        <div className={styles.inputWrapper}>
          <input
            type="password"
            className={styles.input}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className={styles.inputIcon}>
            <i className="fas fa-lock"></i>
          </span>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitBtn}>Log in</button>
        <p className={styles.orText}>or</p>
        <Link href="/signup">
          <button type="button" className={styles.altBtn}>I'm new, sign me up!</button>
        </Link>
      </form>
    </div>
  );
}
