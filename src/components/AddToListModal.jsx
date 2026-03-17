'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { fetchMediaDetails, getPosterUrl } from '../lib/tmdb';
import { Globe, Lock, Check } from 'lucide-react';
import Image from 'next/image';
import Modal from './Modal';
import styles from './AddToListModal.module.css';

function PosterGrid({ posters }) {
  return (
    <div className={styles.posterGrid}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.posterCell}>
          {posters?.[i]
            ? <Image src={getPosterUrl(posters[i], 'w200')} alt="" fill className={styles.posterImg} sizes="28px" />
            : <div className={styles.posterEmpty} />
          }
        </div>
      ))}
    </div>
  );
}

function getItemLabel(items, count) {
  if (!count) return '0 titles';
  const allMovies = items.length > 0 && items.every((i) => i.mediaType === 'movie');
  const allTV = items.length > 0 && items.every((i) => i.mediaType === 'tv');
  const noun = allMovies ? 'film' : allTV ? 'show' : 'title';
  return `${count} ${noun}${count !== 1 ? 's' : ''}`;
}

export default function AddToListModal({ mediaId, mediaType, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [origWatchlist, setOrigWatchlist] = useState(false);
  const [origLists, setOrigLists] = useState([]);
  const [draftWatchlist, setDraftWatchlist] = useState(false);
  const [draftLists, setDraftLists] = useState([]);
  const [watchlistMeta, setWatchlistMeta] = useState({ count: 0, posters: [] });

  const [pendingNewLists, setPendingNewLists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVisibility, setNewVisibility] = useState('public');

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      const watchlist = data.lists?.watchlist || [];
      const inWatchlist = watchlist.some((w) => w.mediaId === String(mediaId));
      setOrigWatchlist(inWatchlist);
      setDraftWatchlist(inWatchlist);

      const wlPosters = await Promise.all(
        watchlist.slice(0, 4).map(async (item) => {
          try { const d = await fetchMediaDetails(item.mediaType, item.mediaId); return d.poster_path || ''; }
          catch { return ''; }
        })
      );
      setWatchlistMeta({ count: watchlist.length, items: watchlist, posters: wlPosters });

      const listsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'customLists'), orderBy('createdAt', 'asc'))
      );
      const lists = await Promise.all(
        listsSnap.docs.map(async (d) => {
          const listData = d.data();
          const items = listData.items || [];
          const posters = await Promise.all(
            items.slice(0, 4).map(async (item) => {
              try { const md = await fetchMediaDetails(item.mediaType, item.mediaId); return md.poster_path || ''; }
              catch { return ''; }
            })
          );
          return {
            id: d.id,
            name: listData.name,
            visibility: listData.visibility || 'public',
            items,
            posters,
            isAdded: items.some((i) => i.mediaId === String(mediaId)),
          };
        })
      );
      setOrigLists(lists);
      setDraftLists(lists);
      setLoading(false);
    };
    load();
  }, [user, mediaId]);

  const stageNewList = () => {
    if (!newName.trim()) return;
    setPendingNewLists((prev) => [
      ...prev,
      { tempId: Date.now(), name: newName.trim(), desc: newDesc.trim(), visibility: newVisibility, isAdded: true, items: [], posters: [] },
    ]);
    setNewName('');
    setNewDesc('');
    setNewVisibility('public');
    setShowCreate(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (draftWatchlist !== origWatchlist) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        const lists = data.lists || {};
        const current = lists.watchlist || [];
        const updated = draftWatchlist
          ? [...current, { mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }]
          : current.filter((i) => i.mediaId !== String(mediaId));
        await setDoc(userRef, { lists: { ...lists, watchlist: updated } }, { merge: true });
      }
      for (const list of draftLists) {
        const orig = origLists.find((l) => l.id === list.id);
        if (orig && orig.isAdded !== list.isAdded) {
          const listRef = doc(db, 'users', user.uid, 'customLists', list.id);
          const snap = await getDoc(listRef);
          const items = snap.exists() ? snap.data().items || [] : [];
          const updated = list.isAdded
            ? [...items, { mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }]
            : items.filter((i) => i.mediaId !== String(mediaId));
          await updateDoc(listRef, { items: updated });
        }
      }
      for (const pending of pendingNewLists) {
        if (!pending.isAdded) continue;
        await addDoc(collection(db, 'users', user.uid, 'customLists'), {
          name: pending.name,
          description: pending.desc,
          visibility: pending.visibility,
          items: [{ mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }],
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save list changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = [
    draftWatchlist,
    ...draftLists.map((l) => l.isAdded),
    ...pendingNewLists.map((l) => l.isAdded),
  ].filter(Boolean).length;

  const q = searchQuery.toLowerCase();
  const showWatchlist = !q || 'want to watch'.includes(q);
  const filteredLists = draftLists.filter((l) => !q || l.name.toLowerCase().includes(q));
  const filteredPending = pendingNewLists.filter((l) => !q || l.name.toLowerCase().includes(q));

  const saveLabel = saving ? 'Saving...' : 'Add';

  if (showCreate) {
    return (
      <Modal
        title="New list"
        onClose={onClose}
        onBack={() => setShowCreate(false)}
        actions={[
          { label: 'Cancel', onClick: () => setShowCreate(false), variant: 'secondary' },
          { label: 'Create', onClick: stageNewList, disabled: !newName.trim() },
        ]}
      >
        <input
          className={styles.createInput}
          placeholder="List name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') stageNewList(); if (e.key === 'Escape') setShowCreate(false); }}
          autoFocus
          spellCheck={false}
        />
        <textarea
          className={styles.createTextarea}
          placeholder="Description (optional)"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
        />
        <div className={styles.createVisibility}>
          <button
            className={newVisibility === 'public' ? styles.createVisibilityBtnActive : styles.createVisibilityBtn}
            onClick={() => setNewVisibility('public')}
          >
            <Globe size={14} /> Public
          </button>
          <button
            className={newVisibility === 'private' ? styles.createVisibilityBtnActive : styles.createVisibilityBtn}
            onClick={() => setNewVisibility('private')}
          >
            <Lock size={14} /> Private
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Add to list"
      onClose={onClose}
      maxWidth="460px"
      actions={[
        { label: 'Cancel', onClick: onClose, variant: 'secondary' },
        { label: saveLabel, onClick: handleSave, disabled: saving || selectedCount === 0 },
      ]}
    >
      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : !user ? (
        <div className={styles.empty}>Sign in to add to lists.</div>
      ) : (
        <>
          <div className={styles.searchWrapper}>
            <input
              className={styles.searchInput}
              placeholder="Search lists"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <i className={`fas fa-search ${styles.searchIcon}`} aria-hidden="true" />
          </div>

          <div className={styles.listRows}>
            {showWatchlist && (
              <button
                className={`${styles.listRow} ${draftWatchlist ? styles.listRowSelected : ''}`}
                onClick={() => setDraftWatchlist((v) => !v)}
              >
                <PosterGrid posters={watchlistMeta.posters} />
                <div className={styles.listInfo}>
                  <span className={styles.listName}>Want to Watch</span>
                  <span className={styles.listMeta}>{watchlistMeta.count} titles · Public</span>
                </div>
                <div className={`${styles.checkbox} ${draftWatchlist ? styles.checkboxChecked : ''}`}>
                  {draftWatchlist && <Check size={13} strokeWidth={3} />}
                </div>
              </button>
            )}
            {filteredLists.map((list) => (
              <button
                key={list.id}
                className={`${styles.listRow} ${list.isAdded ? styles.listRowSelected : ''}`}
                onClick={() => setDraftLists((prev) =>
                  prev.map((l) => l.id === list.id ? { ...l, isAdded: !l.isAdded } : l)
                )}
              >
                <PosterGrid posters={list.posters} />
                <div className={styles.listInfo}>
                  <span className={styles.listName}>{list.name}</span>
                  <span className={styles.listMeta}>
                    {getItemLabel(list.items, list.items.length)} · {list.visibility === 'private' ? 'Private' : 'Public'}
                  </span>
                </div>
                <div className={`${styles.checkbox} ${list.isAdded ? styles.checkboxChecked : ''}`}>
                  {list.isAdded && <Check size={13} strokeWidth={3} />}
                </div>
              </button>
            ))}
            {filteredPending.map((list) => (
              <button
                key={list.tempId}
                className={`${styles.listRow} ${list.isAdded ? styles.listRowSelected : ''}`}
                onClick={() => setPendingNewLists((prev) =>
                  prev.map((l) => l.tempId === list.tempId ? { ...l, isAdded: !l.isAdded } : l)
                )}
              >
                <PosterGrid posters={[]} />
                <div className={styles.listInfo}>
                  <span className={styles.listName}>{list.name}</span>
                  <span className={styles.listMeta}>0 titles · {list.visibility === 'private' ? 'Private' : 'Public'}</span>
                </div>
                <div className={`${styles.checkbox} ${list.isAdded ? styles.checkboxChecked : ''}`}>
                  {list.isAdded && <Check size={13} strokeWidth={3} />}
                </div>
              </button>
            ))}
          </div>

          <button className={styles.newListBtn} onClick={() => setShowCreate(true)}>
            <i className="fas fa-plus" aria-hidden="true" />
            New list
          </button>
        </>
      )}
    </Modal>
  );
}
