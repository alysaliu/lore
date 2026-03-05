'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import ProfileTabs from '../../components/ProfileTabs';
import styles from './page.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [userData, setUserData] = useState(null);
  const [tipHidden, setTipHidden] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipHidden(localStorage.getItem('dismissedTip') === 'true');
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setUserData(snap.data());
    })();
  }, [user, loading]);

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

  const dismissTip = () => {
    setTipHidden(true);
    localStorage.setItem('dismissedTip', 'true');
  };

  if (loading) return null;

  const fullName = userData
    ? `${userData.firstname || ''} ${userData.lastname || ''}`.trim()
    : '';
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
                <h2>{fullName || 'Unnamed'}</h2>
                <p className={styles.email}>{user?.email || ''}</p>
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
              <button className={styles.logoutButton} onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>

        {!tipHidden && (
          <div className={styles.alerts}>
            <div className={styles.inlineAlertTip}>
              <div className={styles.alertHeader}>
                💡 Quick tip
                <button className={styles.alertClose} onClick={dismissTip}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <p>Share your profile link to add friends — more ways to connect coming soon!</p>
            </div>
          </div>
        )}

        {user && <ProfileTabs userId={user.uid} />}
      </div>
    </div>
  );
}
