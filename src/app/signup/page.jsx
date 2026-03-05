'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import styles from './page.module.css';

export default function SignupPage() {
  const router = useRouter();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, 'users', user.uid), {
        firstname,
        lastname,
        email: user.email,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid, 'lists', 'watchlist'), {
        items: [],
      });

      router.push('/explore');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.title}>
        <h1>Welcome to Lore</h1>
        <h3>Dive into the rabbithole</h3>
      </div>

      <Image
        src="/images/Rabbit.svg"
        alt="Lore"
        width={60}
        height={60}
        className={styles.logo}
      />

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.input}
            placeholder="First name"
            value={firstname}
            onChange={(e) => setFirstname(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.input}
            placeholder="Last name"
            value={lastname}
            onChange={(e) => setLastname(e.target.value)}
            required
          />
        </div>

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

        <button type="submit" className={styles.submitBtn}>Sign up</button>
        <p className={styles.orText}>or</p>
        <Link href="/login">
          <button type="button" className={styles.altBtn}>I've been here before :)</button>
        </Link>
      </form>
    </div>
  );
}
