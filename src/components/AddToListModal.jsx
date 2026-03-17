'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { X, Globe, Lock } from 'lucide-react';
import styles from './AddToListModal.module.css';

export default function AddToListModal({ mediaId, mediaType, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Original state loaded from Firestore (never mutated after load)
  const [origWatchlist, setOrigWatchlist] = useState(false);
  const [origLists, setOrigLists] = useState([]);

  // Draft state — what the user has selected but not yet saved
  const [draftWatchlist, setDraftWatchlist] = useState(false);
  const [draftLists, setDraftLists] = useState([]);

  // New lists staged locally (not yet in Firestore)
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

      const listsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'customLists'), orderBy('createdAt', 'asc'))
      );
      const lists = listsSnap.docs.map((d) => {
        const items = d.data().items || [];
        return { id: d.id, name: d.data().name, isAdded: items.some((i) => i.mediaId === String(mediaId)) };
      });
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
      { tempId: Date.now(), name: newName.trim(), desc: newDesc.trim(), visibility: newVisibility, isAdded: true },
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
      // Watchlist
      if (draftWatchlist !== origWatchlist) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        const lists = data.lists || {};
        const current = lists.watchlist || [];
        const alreadyInWatchlist = current.some((w) => w.mediaId === String(mediaId));
        const updated = draftWatchlist
          ? alreadyInWatchlist ? current : [...current, { mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }]
          : current.filter((i) => i.mediaId !== String(mediaId));
        await setDoc(userRef, { lists: { ...lists, watchlist: updated } }, { merge: true });
      }

      // Changed custom lists
      for (const list of draftLists) {
        const orig = origLists.find((l) => l.id === list.id);
        if (orig && orig.isAdded !== list.isAdded) {
          const listRef = doc(db, 'users', user.uid, 'customLists', list.id);
          const snap = await getDoc(listRef);
          const items = snap.exists() ? snap.data().items || [] : [];
          const alreadyInList = items.some((i) => i.mediaId === String(mediaId));
          const updated = list.isAdded
            ? alreadyInList ? items : [...items, { mediaId: String(mediaId), mediaType, timestamp: new Date().toISOString() }]
            : items.filter((i) => i.mediaId !== String(mediaId));
          await updateDoc(listRef, { items: updated });
        }
      }

      // New lists
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
              <button className={styles.listRow} onClick={() => setDraftWatchlist((v) => !v)}>
                <div className={`${styles.check} ${draftWatchlist ? styles.checkActive : ''}`}>
                  {draftWatchlist && <i className="fas fa-check" />}
                </div>
                <span className={styles.listName}>Want to Watch</span>
              </button>
              {draftLists.map((list) => (
                <button
                  key={list.id}
                  className={styles.listRow}
                  onClick={() => setDraftLists((prev) =>
                    prev.map((l) => l.id === list.id ? { ...l, isAdded: !l.isAdded } : l)
                  )}
                >
                  <div className={`${styles.check} ${list.isAdded ? styles.checkActive : ''}`}>
                    {list.isAdded && <i className="fas fa-check" />}
                  </div>
                  <span className={styles.listName}>{list.name}</span>
                </button>
              ))}
              {pendingNewLists.map((list) => (
                <button
                  key={list.tempId}
                  className={styles.listRow}
                  onClick={() => setPendingNewLists((prev) =>
                    prev.map((l) => l.tempId === list.tempId ? { ...l, isAdded: !l.isAdded } : l)
                  )}
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
                    <Globe size={14} /> Public
                  </button>
                  <button
                    className={newVisibility === 'private' ? styles.visibilityBtnActive : styles.visibilityBtn}
                    onClick={() => setNewVisibility('private')}
                  >
                    <Lock size={14} /> Private
                  </button>
                </div>
                <div className={styles.formButtons}>
                  <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                  <button
                    className={styles.saveBtn}
                    onClick={stageNewList}
                    disabled={!newName.trim()}
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.newListBtn} onClick={() => setShowCreate(true)}>
                <i className="fas fa-plus" aria-hidden="true" /> New list
              </button>
            )}

            <div className={styles.divider} />

            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
