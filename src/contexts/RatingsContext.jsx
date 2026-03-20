'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRatings } from '../lib/ratingsFirestore';
import { useAuth } from './AuthContext';

const RatingsContext = createContext(null);

export function RatingsProvider({ children }) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshRatings = useCallback(async () => {
    if (!user?.uid) {
      setRatings(null);
      setError(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getRatings(user.uid);
      setRatings(data);
      return data;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setRatings(null);
      setError(null);
      setLoading(false);
      return;
    }
    refreshRatings().catch(() => {});
  }, [user?.uid, refreshRatings]);

  const value = useMemo(() => ({
    ratings,
    setRatings,
    refreshRatings,
    loading,
    error,
  }), [ratings, setRatings, refreshRatings, loading, error]);

  return (
    <RatingsContext.Provider value={value}>
      {children}
    </RatingsContext.Provider>
  );
}

export function useRatings() {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatings must be used inside RatingsProvider');
  return ctx;
}

