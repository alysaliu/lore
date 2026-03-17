'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, FolderOpen, ExternalLink } from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../login/page.module.css';
import onboardStyles from './page.module.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const TOTAL_STEPS = 2;

function Stepper({ current }) {
  return (
    <div className={onboardStyles.stepper}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={i + 1 <= current ? onboardStyles.stepActive : onboardStyles.stepInactive}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [importFolder, setImportFolder] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const folderInputRef = useRef(null);
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

      if (usernameSnap.exists() && trimmed !== savedUsername) {
        setError('That username is already taken.');
        setSaving(false);
        return;
      }

      const nameParts = (user.displayName || '').split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';

      if (savedUsername && savedUsername !== trimmed) {
        await deleteDoc(doc(db, 'usernames', savedUsername));
      }

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

      setSavedUsername(trimmed);
      setStep(2);
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  if (step === 2) {
    return (
      <div className={styles.formSection}>
        <Stepper current={2} />
        <div className={onboardStyles.appIcon}>
          <Image src="/images/Letterboxd.svg" alt="Letterboxd" width={24} height={24} />
        </div>
        <div className={styles.title}>
          <h1>Import ratings from Letterboxd</h1>
          <h3>Keep your film journey all in one place</h3>
        </div>
        <div className={styles.form}>
          <div className={onboardStyles.steps}>
            <div className={onboardStyles.step}>
              <span className={onboardStyles.stepNumber}>1</span>
              <a
                className={onboardStyles.stepLink}
                href="https://letterboxd.com/settings/data/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Export your Letterboxd data <ExternalLink size={14} />
              </a>
            </div>
            <div className={onboardStyles.step}>
              <span className={onboardStyles.stepNumber}>2</span>
              <span className={onboardStyles.stepLabel}>Upload file</span>
            </div>
          </div>
          <div
            className={`${onboardStyles.dropzone} ${dragOver ? onboardStyles.dropzoneOver : ''} ${importFolder ? onboardStyles.dropzoneFilled : ''}`}
            onClick={() => folderInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const item = e.dataTransfer.items?.[0];
              if (item?.webkitGetAsEntry()?.isDirectory) {
                setImportFolder(item.webkitGetAsEntry().name);
              } else if (e.dataTransfer.files?.[0]) {
                setImportFolder(e.dataTransfer.files[0].name);
              }
            }}
          >
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory="true"
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) {
                  const folder = files[0].webkitRelativePath.split('/')[0];
                  setImportFolder(folder || files[0].name);
                }
              }}
            />
            {importFolder ? (
              <>
                <FolderOpen size={20} className={onboardStyles.dropzoneIcon} />
                <span className={onboardStyles.dropzoneFolderName}>{importFolder}</span>
              </>
            ) : (
              <>
                <FolderOpen size={20} className={onboardStyles.dropzoneIcon} />
                <span className={onboardStyles.dropzoneLabel}>Drop your Letterboxd export folder</span>
                <span className={onboardStyles.dropzoneHint}>or click to browse</span>
              </>
            )}
          </div>
          <button className={styles.submitBtn} disabled={!importFolder} onClick={() => router.push('/explore')}>
            Import
          </button>
          <button className={styles.altBtn} onClick={() => router.push('/explore')}>
            Skip for now
          </button>
          <button className={styles.altBtn} onClick={async () => {
            if (savedUsername) await deleteDoc(doc(db, 'usernames', savedUsername));
            setSavedUsername('');
            setStep(1);
          }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formSection}>
      <Stepper current={1} />
      <div className={styles.title}>
        <h1>Pick a username</h1>
        <h3>This is how others will find you on Lore</h3>
      </div>
      <Image src="/images/Rabbit.svg" alt="Lore" width={60} height={60} className={styles.logo} />
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
