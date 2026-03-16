'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { X } from 'lucide-react';
import styles from './AddToListModal.module.css';

export default function AddToListModal({ mediaId, mediaType, onClose }) {
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [customLists, setCustomLists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVisibility, setNewVisibility] = useState('public');
  const [saving, setSaving] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      const watchlist = data.lists?.watchlist || [];
      setInWatchlist(watchlist.some((w) => w.mediaId === String(mediaId)));

      const listsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'customLists'), orderBy('createdAt', 'asc'))
      );
      setCustomLists(
        listsSnap.docs.map((d) => {
          const items = d.data().items || [];
          return { id: d.id, name: d.data().name, isAdded: items.some((i) => i.mediaId === String(mediaId)) };
        })
      );
      setLoading(false);
    };
    load();
  }, [user, mediaId]);

  const toggleWatchlist = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    const lists = data.lists || {};
    const current = lists.watchlist || [];
    const updated = inWatchlist
      ? current.filter((i) => i.mediaId !== String(mediaId))
      : [...current, { mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }];
    await setDoc(userRef, { lists: { ...lists, watchlist: updated } }, { merge: true });
    setInWatchlist(!inWatchlist);
  };

  const toggleCustomList = async (listId, currentlyAdded) => {
    if (!user) return;
    const listRef = doc(db, 'users', user.uid, 'customLists', listId);
    const snap = await getDoc(listRef);
    const items = snap.exists() ? snap.data().items || [] : [];
    const updated = currentlyAdded
      ? items.filter((i) => i.mediaId !== String(mediaId))
      : [...items, { mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }];
    await updateDoc(listRef, { items: updated });
    setCustomLists((prev) =>
      prev.map((l) => l.id === listId ? { ...l, isAdded: !currentlyAdded } : l)
    );
  };

  const createList = async () => {
    if (!newName.trim() || !user) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'customLists'), {
        name: newName.trim(),
        description: newDesc.trim(),
        visibility: newVisibility,
        items: [{ mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }],
        createdAt: serverTimestamp(),
      });
      setCustomLists((prev) => [...prev, { id: docRef.id, name: newName.trim(), isAdded: true }]);
      setNewName('');
      setNewDesc('');
      setNewVisibility('public');
      setShowCreate(false);
    } catch (err) {
      console.error('Failed to create list:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Add to list</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : !user ? (
          <div className={styles.empty}>Sign in to add to lists.</div>
        ) : (
          <>
            <div className={styles.listRows}>
              <button className={styles.listRow} onClick={toggleWatchlist}>
                <div className={`${styles.check} ${inWatchlist ? styles.checkActive : ''}`}>
                  {inWatchlist && <i className="fas fa-check" />}
                </div>
                <span className={styles.listName}>Want to Watch</span>
              </button>
              {customLists.map((list) => (
                <button
                  key={list.id}
                  className={styles.listRow}
                  onClick={() => toggleCustomList(list.id, list.isAdded)}
                >
                  <div className={`${styles.check} ${list.isAdded ? styles.checkActive : ''}`}>
                    {list.isAdded && <i className="fas fa-check" />}
                  </div>
                  <span className={styles.listName}>{list.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            {showCreate ? (
              <div className={styles.createForm}>
                <input
                  className={styles.input}
                  placeholder="List name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <textarea
                  className={styles.textarea}
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <div className={styles.visibility}>
                  <button
                    className={newVisibility === 'public' ? styles.visibilityBtnActive : styles.visibilityBtn}
                    onClick={() => setNewVisibility('public')}
                  >
                    <i className="fas fa-globe" aria-hidden="true" /> Public
                  </button>
                  <button
                    className={newVisibility === 'private' ? styles.visibilityBtnActive : styles.visibilityBtn}
                    onClick={() => setNewVisibility('private')}
                  >
                    <i className="fas fa-lock" aria-hidden="true" /> Private
                  </button>
                </div>
                <div className={styles.formButtons}>
                  <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                  <button
                    className={styles.saveBtn}
                    onClick={createList}
                    disabled={!newName.trim() || saving}
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.newListBtn} onClick={() => setShowCreate(true)}>
                <i className="fas fa-plus" aria-hidden="true" /> New list
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
