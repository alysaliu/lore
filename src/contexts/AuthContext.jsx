'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initials, setInitials] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            const first = data.firstname || '';
            const last = data.lastname || '';
            setInitials((first.charAt(0) + last.charAt(0)).toUpperCase());
            setPhotoURL(data.photoURL || '');
          } else {
            const parts = firebaseUser.email
              .split(/[@.\s_]/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p.charAt(0).toUpperCase());
            setInitials(parts.join(''));
            setPhotoURL('');
          }
        } catch {
          setInitials('');
          setPhotoURL('');
        }
      } else {
        setUser(null);
        setInitials('');
        setPhotoURL('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initials, photoURL, setPhotoURL, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
