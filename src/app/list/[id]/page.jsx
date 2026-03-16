'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { fetchMediaDetails, getPosterUrl } from '../../../lib/tmdb';
import { useAuth } from '../../../contexts/AuthContext';
import MediaCard from '../../../components/MediaCard';
import styles from './page.module.css';

function ListContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const router = useRouter();
  const { user } = useAuth();

  const [listData, setListData] = useState(null);
  const [items, setItems] = useState(null);
  const [ownerName, setOwnerName] = useState('');
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    if (!uid || !id) return;

    (async () => {
      const [listSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid, 'customLists', id)),
        getDoc(doc(db, 'users', uid)),
      ]);

      if (!listSnap.exists()) return;
      const list = { id: listSnap.id, ...listSnap.data() };
      setListData(list);

      if (userSnap.exists()) {
        const u = userSnap.data();
        const name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.username || 'Unknown';
        setOwnerName(name);
      }

      if (list.items?.length) {
        const enriched = await Promise.all(
          list.items.map(async (item) => {
            const d = await fetchMediaDetails(item.mediaType, item.mediaId);
            return {
              mediaId: item.mediaId,
              mediaType: item.mediaType,
              title: d.title || d.name || 'Untitled',
              year: (d.release_date || d.first_air_date || '').split('-')[0],
              posterPath: d.poster_path || '',
              overview: d.overview || '',
            };
          })
        );
        setItems(enriched);
      } else {
        setItems([]);
      }
    })();
  }, [uid, id]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) setWatchlist(snap.data().lists?.watchlist || []);
    });
  }, [user]);

  const isOwner = user?.uid === uid;
  const backHref = isOwner ? '/profile' : `/user?uid=${uid}`;

  return (
    <div className={styles.listSection}>
      <div className={styles.listContainer}>
        <div className={styles.listHeader}>
          <button className={styles.backBtn} onClick={() => router.push(backHref)}>
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <nav className={styles.breadcrumb} aria-label="breadcrumb">
            <button className={styles.breadcrumbLink} onClick={() => router.push(backHref)}>
              {ownerName || 'Profile'}
            </button>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbLink} onClick={() => router.push(`${backHref}#lists`)}>
              Lists
            </span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>
              {listData?.name || '…'}
            </span>
          </nav>
        </div>

        {listData && (
          <div className={styles.listMeta}>
            <h1 className={styles.listTitle}>{listData.name}</h1>
            <div className={styles.listSubMeta}>
              <span className={styles.listCount}>{listData.items?.length || 0} titles</span>
              <span className={styles.listMetaDot}>·</span>
              <i
                className={`fas ${listData.visibility === 'private' ? 'fa-lock' : 'fa-globe'}`}
                aria-hidden="true"
              />
              <span>{listData.visibility === 'private' ? 'Private' : 'Public'}</span>
            </div>
            {listData.description && (
              <p className={styles.listDescription}>{listData.description}</p>
            )}
          </div>
        )}

        <div className={styles.resultsContainer}>
          {items === null ? (
            <p className={styles.emptyState}>Loading...</p>
          ) : items.length === 0 ? (
            <p className={styles.emptyState}>No titles in this list yet.</p>
          ) : (
            items.map((item) => (
              <MediaCard
                key={`${item.mediaType}-${item.mediaId}`}
                mediaId={item.mediaId}
                mediaType={item.mediaType}
                title={item.title}
                year={item.year}
                overview={item.overview}
                posterPath={item.posterPath}
                variant="grid"
                inWatchlist={watchlist.some((w) => w.mediaId === String(item.mediaId))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={null}>
      <ListContent />
    </Suspense>
  );
}
