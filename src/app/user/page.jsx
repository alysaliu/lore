'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import ProfileTabs from '../../components/ProfileTabs';
import styles from './page.module.css';

function UserContent() {
  const searchParams = useSearchParams();
  const selectedUserId = searchParams.get('uid');
  const { user } = useAuth();

  const [targetUserData, setTargetUserData] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    if (!selectedUserId) return;
    loadTargetUser();
  }, [selectedUserId]);

  useEffect(() => {
    if (!user || !selectedUserId) return;
    setIsSelf(user.uid === selectedUserId);
    checkFollowing();
  }, [user, selectedUserId]);

  const loadTargetUser = async () => {
    const snap = await getDoc(doc(db, 'users', selectedUserId));
    if (snap.exists()) setTargetUserData(snap.data());
  };

  const checkFollowing = async () => {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      setIsFollowing((data.followinglist || []).includes(selectedUserId));
    }
  };

  const handleFollow = async () => {
    if (!user) return;
    const currentUserRef = doc(db, 'users', user.uid);
    const targetUserRef = doc(db, 'users', selectedUserId);

    try {
      if (isFollowing) {
        await updateDoc(currentUserRef, { followinglist: arrayRemove(selectedUserId) });
        await updateDoc(targetUserRef, { followerlist: arrayRemove(user.uid) });
        setIsFollowing(false);
      } else {
        await setDoc(currentUserRef, { followinglist: arrayUnion(selectedUserId) }, { merge: true });
        await setDoc(targetUserRef, { followerlist: arrayUnion(user.uid) }, { merge: true });
        setIsFollowing(true);
      }
      loadTargetUser();
    } catch (err) {
      console.error('Follow failed:', err);
    }
  };

  const handleShare = () => {
    const link = `${window.location.origin}/user?uid=${selectedUserId}`;
    navigator.clipboard.writeText(link)
      .then(() => alert('Profile link copied to clipboard!'))
      .catch(() => alert(`Here's the profile link: ${link}`));
  };

  const fullName = targetUserData
    ? `${targetUserData.firstname || ''} ${targetUserData.lastname || ''}`.trim()
    : '';
  const ratingCount = targetUserData?.ratingCount || 0;
  const followersCount = targetUserData?.followerlist?.length || 0;
  const followingCount = targetUserData?.followinglist?.length || 0;

  return (
    <div className={styles.profileSection}>
      <div className={styles.profileContainer}>
        <div className={styles.profileHeader}>
          <div className={styles.userInfo}>
            <div className={styles.userInfoRow}>
              <div className={styles.identifierSection}>
                <h2>{fullName || 'Unnamed'}</h2>
              </div>
              <div className={styles.statsSection}>
                <div>
                  <span className={styles.statNumber}>{ratingCount}</span>
                  <span className={styles.statDescription}> ratings</span>
                </div>
                <div>
                  <span className={styles.statNumber}>{followersCount}</span>
                  <span className={styles.statDescription}> followers</span>
                </div>
                <div>
                  <span className={styles.statNumber}>{followingCount}</span>
                  <span className={styles.statDescription}> following</span>
                </div>
              </div>
            </div>
            <div className={styles.buttons}>
              <button className={styles.btn} onClick={handleShare}>
                <i className="fas fa-link"></i>Share profile
              </button>
              {user && !isSelf && (
                <button
                  className={`${styles.followButton} ${isFollowing ? styles.following : ''}`}
                  onClick={handleFollow}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedUserId && <ProfileTabs userId={selectedUserId} />}
      </div>
    </div>
  );
}

export default function UserPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-text-secondary)' }}>
        Loading...
      </div>
    }>
      <UserContent />
    </Suspense>
  );
}
