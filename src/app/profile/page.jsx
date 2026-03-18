'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import ProfileTabs from '../../components/ProfileTabs';
import { Pencil, X } from 'lucide-react';
import styles from './page.module.css';
import inputStyles from '../login/page.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, photoURL, setPhotoURL } = useAuth();
  const [userData, setUserData] = useState(null);
  /** false until Firestore users/{uid} fetch finishes (avoids Unnamed / @set username flash). */
  const [profileReady, setProfileReady] = useState(false);
  /** true until localStorage is read (useLayoutEffect, before first paint). */
  const [tipHidden, setTipHidden] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [listModalType, setListModalType] = useState(null); // 'followers' | 'following'
  const [listUsers, setListUsers] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const fileInputRef = useRef(null);

  const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

  useLayoutEffect(() => {
    try {
      setTipHidden(localStorage.getItem('dismissedTip') === 'true');
    } catch {
      setTipHidden(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    setProfileReady(false);
    setUserData(null);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setUserData(snap.exists() ? snap.data() : {});
      } catch {
        setUserData({});
      } finally {
        setProfileReady(true);
      }
    })();
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleShare = () => {
    if (!user) return;
    const link = `${window.location.origin}/user?uid=${user.uid}`;
    navigator.clipboard.writeText(link)
      .then(() => alert('Profile link copied to clipboard!'))
      .catch(() => alert(`Here's your profile link: ${link}`));
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setPhotoURL(url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const startEditUsername = () => {
    setUsernameInput(userData?.username || '');
    setUsernameError('');
    setEditingUsername(true);
  };

  const saveUsername = async () => {
    const trimmed = usernameInput.trim().toLowerCase();
    if (!USERNAME_RE.test(trimmed)) {
      setUsernameError('3–20 chars, letters, numbers, underscores only.');
      return;
    }
    if (trimmed === userData?.username) { setEditingUsername(false); return; }

    setSavingUsername(true);
    setUsernameError('');
    try {
      const usernameRef = doc(db, 'usernames', trimmed);
      const snap = await getDoc(usernameRef);
      if (snap.exists()) { setUsernameError('Already taken.'); setSavingUsername(false); return; }

      let isDeveloper = false;
      if (userData?.username) {
        const oldSnap = await getDoc(doc(db, 'usernames', userData.username));
        if (oldSnap.exists()) isDeveloper = Boolean(oldSnap.data().isDeveloper);
        await deleteDoc(doc(db, 'usernames', userData.username));
      }
      await setDoc(usernameRef, { uid: user.uid, isDeveloper });
      await updateDoc(doc(db, 'users', user.uid), { username: trimmed });
      setUserData((prev) => ({ ...prev, username: trimmed }));
      setEditingUsername(false);
    } catch {
      setUsernameError('Something went wrong.');
    } finally {
      setSavingUsername(false);
    }
  };

  const dismissTip = () => {
    setTipHidden(true);
    localStorage.setItem('dismissedTip', 'true');
  };

  const openListModal = async (type) => {
    if (!userData || !db) return;
    const uids = type === 'followers' ? (userData.followerlist || []) : (userData.followinglist || []);
    setListModalType(type);
    setListUsers([]);
    setListLoading(true);
    try {
      const snaps = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
      const users = snaps
        .filter((s) => s.exists())
        .map((s) => ({ uid: s.id, ...s.data() }));
      setListUsers(users);
    } catch (e) {
      console.error(e);
    } finally {
      setListLoading(false);
    }
  };

  const closeListModal = () => {
    setListModalType(null);
    setListUsers([]);
  };

  if (loading) return null;

  const fullName = userData
    ? `${userData.firstname || ''} ${userData.lastname || ''}`.trim()
    : '';
  const displayName = profileReady ? (fullName || 'Unnamed') : '';
  const displayUsername = profileReady ? (userData?.username ? `@${userData.username}` : '@set username') : '';
  const ratingCount = userData?.ratingCount || 0;
  const followersCount = userData?.followerlist?.length || 0;
  const followingCount = userData?.followinglist?.length || 0;

  return (
    <div className={styles.profileSection}>
      <div className={styles.profileContainer}>
        <div className={styles.profileHeader}>
          <div className={styles.userInfo}>
            <div className={styles.userInfoRow}>
              <div className={styles.identifierSection}>
                <button className={styles.avatarBtn} onClick={handleAvatarClick} disabled={uploading} aria-label="Change profile picture">
                  {photoURL
                    ? <Image src={photoURL} alt="Profile" className={styles.avatarImg} width={96} height={96} />
                    : <span className={styles.avatarInitials}>{profileReady ? (fullName ? `${fullName.split(' ')[0][0]}${fullName.split(' ')[1]?.[0] || ''}`.toUpperCase() : '?') : '\u00a0'}</span>
                  }
                  <span className={styles.avatarOverlay}>{uploading ? '...' : <i className="fas fa-camera" aria-hidden="true" />}</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <div className={styles.nameBlock}>
                  <h2 className={!profileReady ? styles.profileHeaderPending : undefined}>
                    {profileReady ? displayName : '\u00a0'}
                  </h2>
                  {profileReady ? (
                    <button type="button" className={styles.usernameBtn} onClick={startEditUsername}>
                      <span>{displayUsername}</span>
                      <Pencil size={16} className={styles.usernamePencil} />
                    </button>
                  ) : (
                    <div className={styles.usernameRowPending} aria-hidden />
                  )}
                </div>
              </div>
              <div className={styles.statsSection}>
                <div className={styles.statItem}>
                  <span className="eyebrow">Ratings</span>
                  <span className={`${styles.statNumber} ${!profileReady ? styles.statNumberPending : ''}`}>
                    {profileReady ? ratingCount : '\u00a0'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.statItemButton}
                  onClick={() => openListModal('followers')}
                  aria-label="View followers"
                  disabled={!profileReady}
                >
                  <span className="eyebrow">Followers</span>
                  <span className={`${styles.statNumber} ${!profileReady ? styles.statNumberPending : ''}`}>
                    {profileReady ? followersCount : '\u00a0'}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.statItemButton}
                  onClick={() => openListModal('following')}
                  aria-label="View following"
                  disabled={!profileReady}
                >
                  <span className="eyebrow">Following</span>
                  <span className={`${styles.statNumber} ${!profileReady ? styles.statNumberPending : ''}`}>
                    {profileReady ? followingCount : '\u00a0'}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div className={styles.buttons}>
            <button className={styles.btn} onClick={handleShare}>
              <i className="fas fa-link" aria-hidden="true"></i>Share
            </button>
          </div>
        </div>

        {!tipHidden && (
          <div className={styles.alerts}>
            <div className={styles.inlineAlertTip}>
              <div className={styles.alertHeader}>
                💡 Quick tip
                <button className={styles.alertClose} onClick={dismissTip}>
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
              <p>Share your profile link to add friends — more ways to connect coming soon!</p>
            </div>
          </div>
        )}

        {user && <ProfileTabs userId={user.uid} />}
      </div>

      {editingUsername && (
        <div className={styles.modalBackdrop} onClick={() => setEditingUsername(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit username</h3>
              <button className={styles.modalCloseBtn} onClick={() => setEditingUsername(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={inputStyles.inputWrapper}>
              <span className={inputStyles.inputIconLeft}>@</span>
              <input
                className={inputStyles.inputWithPrefix}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                autoFocus
                spellCheck={false}
                placeholder="username"
              />
            </div>
            {usernameError && <p className={styles.usernameError}>{usernameError}</p>}
            <div className={styles.modalButtons}>
              <button className={styles.modalCancelBtn} onClick={() => setEditingUsername(false)}>Cancel</button>
              <button className={styles.modalSaveBtn} onClick={saveUsername} disabled={savingUsername}>
                {savingUsername ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {listModalType && (
        <div className={styles.modalBackdrop} onClick={closeListModal} role="dialog" aria-modal="true" aria-labelledby="list-modal-title">
          <div className={styles.modalList} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 id="list-modal-title" className={styles.modalTitle}>
                {listModalType === 'followers' ? 'Followers' : 'Following'}
              </h3>
              <button className={styles.modalCloseBtn} onClick={closeListModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalListBody}>
              {listLoading ? (
                <p className={styles.modalListEmpty}>Loading…</p>
              ) : listUsers.length === 0 ? (
                <p className={styles.modalListEmpty}>
                  {listModalType === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
                </p>
              ) : (
                <ul className={styles.modalListUl}>
                  {listUsers.map((u) => {
                    const name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || 'Unnamed';
                    return (
                      <li key={u.uid}>
                        <Link href={`/user?uid=${u.uid}`} className={styles.modalListRow} onClick={closeListModal}>
                          <div className={styles.modalListAvatar}>
                            {u.photoURL
                              ? <Image src={u.photoURL} alt="" width={40} height={40} className={styles.modalListAvatarImg} />
                              : <span className={styles.modalListInitials}>{name ? `${name.split(' ')[0][0]}${name.split(' ')[1]?.[0] || ''}`.toUpperCase() : '?'}</span>
                            }
                          </div>
                          <div className={styles.modalListInfo}>
                            <span className={styles.modalListName}>{name}</span>
                            {u.username && <span className={styles.modalListUsername}>@{u.username}</span>}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
