'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, limit, getDocs, addDoc,
  updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp,
  increment, getDoc, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare } from 'lucide-react';
import styles from './DiscussionSection.module.css';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6b3fa0, #9b5fe0)',
  'linear-gradient(135deg, #1a6b4a, #2db87a)',
  'linear-gradient(135deg, #6b1a1a, #e05f5f)',
  'linear-gradient(135deg, #1a4a6b, #3f8fbf)',
  'linear-gradient(135deg, #6b4a1a, #bf8f3f)',
  'linear-gradient(135deg, #3a6b1a, #72bf3f)',
];

function avatarGradient(uid) {
  if (!uid) return AVATAR_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return 'just now';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function Avatar({ uid, photoURL, username, size = 'md' }) {
  if (photoURL) {
    return <img src={photoURL} alt={username} className={styles[`avatar${size}`]} />;
  }
  return (
    <div className={styles[`avatar${size}`]} style={{ background: avatarGradient(uid) }}>
      {getInitials(username)}
    </div>
  );
}

export default function DiscussionSection({ mediaKey, mediaTitle, userScore }) {
  const { user: authUser, initials: authInitials, photoURL: authPhotoURL } = useAuth();

  const [tab, setTab] = useState('friends');
  const [followingList, setFollowingList] = useState([]);
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [newPostText, setNewPostText] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [posting, setPosting] = useState(false);
  const [openReplies, setOpenReplies] = useState(new Set());
  const [repliesData, setRepliesData] = useState({});
  const [replyTexts, setReplyTexts] = useState({});
  const [openReplyComposer, setOpenReplyComposer] = useState(new Set());
  const [postingReply, setPostingReply] = useState({});
  const [currentUsername, setCurrentUsername] = useState(null);

  useEffect(() => {
    if (!authUser) return;
    getDoc(doc(db, 'users', authUser.uid)).then(snap => {
      if (!snap.exists()) {
        setCurrentUsername(authUser.displayName || 'Anonymous');
        return;
      }
      const data = snap.data();
      setCurrentUsername(data.username || authUser.displayName || 'Anonymous');
      setFollowingList(data.followinglist || []);
    }).catch(() => setCurrentUsername(authUser.displayName || 'Anonymous'));
  }, [authUser]);

  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const threadsRef = collection(db, 'mediaDiscussions', mediaKey, 'threads');
      let q;
      if (tab === 'friends' && followingList.length > 0) {
        // Firestore `in` supports up to 30 values
        const uids = followingList.slice(0, 30);
        q = query(threadsRef, where('uid', 'in', uids), orderBy('createdAt', 'desc'), limit(20));
      } else if (tab === 'friends') {
        setThreads([]);
        setThreadsLoading(false);
        return;
      } else {
        q = query(threadsRef, orderBy('voteCount', 'desc'), limit(20));
      }
      const snap = await getDocs(q);
      setThreads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to load threads', e);
    } finally {
      setThreadsLoading(false);
    }
  }, [tab, mediaKey, followingList]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const handlePostThread = async () => {
    if (!authUser || !newPostText.trim() || posting) return;
    setPosting(true);
    try {
      const threadsRef = collection(db, 'mediaDiscussions', mediaKey, 'threads');
      const data = {
        uid: authUser.uid,
        username: currentUsername || 'Anonymous',
        photoURL: authPhotoURL || null,
        text: newPostText.trim(),
        voteCount: 1,
        upvoterUids: [authUser.uid],
        createdAt: serverTimestamp(),
        replyCount: 0,
        userScore: userScore ?? null,
      };
      const ref = await addDoc(threadsRef, data);
      setThreads(prev => [{ id: ref.id, ...data, createdAt: { toDate: () => new Date() } }, ...prev]);
      setNewPostText('');
      setShowComposer(false);
    } catch (e) {
      console.error('Failed to post thread', e);
    } finally {
      setPosting(false);
    }
  };

  const handleVoteThread = async (threadId) => {
    if (!authUser) return;
    const uid = authUser.uid;
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    const isVoted = (thread.upvoterUids || []).includes(uid);
    const delta = isVoted ? -1 : 1;

    setThreads(prev => prev.map(t => t.id !== threadId ? t : {
      ...t,
      voteCount: (t.voteCount || 0) + delta,
      upvoterUids: isVoted
        ? (t.upvoterUids || []).filter(u => u !== uid)
        : [...(t.upvoterUids || []), uid],
    }));

    try {
      await updateDoc(doc(db, 'mediaDiscussions', mediaKey, 'threads', threadId), {
        voteCount: increment(delta),
        upvoterUids: isVoted ? arrayRemove(uid) : arrayUnion(uid),
      });
    } catch (e) {
      console.error('Vote failed', e);
      loadThreads();
    }
  };

  const loadReplies = async (threadId) => {
    if (repliesData[threadId]) return;
    try {
      const q = query(
        collection(db, 'mediaDiscussions', mediaKey, 'threads', threadId, 'replies'),
        orderBy('createdAt', 'asc'),
      );
      const snap = await getDocs(q);
      setRepliesData(prev => ({ ...prev, [threadId]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    } catch (e) {
      console.error('Failed to load replies', e);
    }
  };

  const toggleReplies = async (threadId) => {
    const next = new Set(openReplies);
    if (next.has(threadId)) {
      next.delete(threadId);
    } else {
      next.add(threadId);
      await loadReplies(threadId);
    }
    setOpenReplies(next);
  };

  const openReplyComposerFor = async (threadId) => {
    const nextOpen = new Set(openReplies);
    nextOpen.add(threadId);
    setOpenReplies(nextOpen);
    await loadReplies(threadId);
    setOpenReplyComposer(prev => new Set([...prev, threadId]));
  };

  const closeReplyComposer = (threadId) => {
    setOpenReplyComposer(prev => { const s = new Set(prev); s.delete(threadId); return s; });
    setReplyTexts(prev => ({ ...prev, [threadId]: '' }));
  };

  const handlePostReply = async (threadId) => {
    if (!authUser || !replyTexts[threadId]?.trim() || postingReply[threadId]) return;
    setPostingReply(prev => ({ ...prev, [threadId]: true }));
    try {
      const data = {
        uid: authUser.uid,
        username: currentUsername || 'Anonymous',
        photoURL: authPhotoURL || null,
        text: replyTexts[threadId].trim(),
        voteCount: 1,
        upvoterUids: [authUser.uid],
        createdAt: serverTimestamp(),
        userScore: userScore ?? null,
      };
      const ref = await addDoc(
        collection(db, 'mediaDiscussions', mediaKey, 'threads', threadId, 'replies'),
        data,
      );
      await updateDoc(doc(db, 'mediaDiscussions', mediaKey, 'threads', threadId), {
        replyCount: increment(1),
      });
      const optimistic = { id: ref.id, ...data, createdAt: { toDate: () => new Date() } };
      setRepliesData(prev => ({ ...prev, [threadId]: [...(prev[threadId] || []), optimistic] }));
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, replyCount: (t.replyCount || 0) + 1 } : t));
      closeReplyComposer(threadId);
    } catch (e) {
      console.error('Failed to post reply', e);
    } finally {
      setPostingReply(prev => ({ ...prev, [threadId]: false }));
    }
  };

  const handleVoteReply = async (threadId, replyId) => {
    if (!authUser) return;
    const uid = authUser.uid;
    const reply = repliesData[threadId]?.find(r => r.id === replyId);
    if (!reply) return;
    const isVoted = (reply.upvoterUids || []).includes(uid);
    const delta = isVoted ? -1 : 1;

    setRepliesData(prev => ({
      ...prev,
      [threadId]: (prev[threadId] || []).map(r => r.id !== replyId ? r : {
        ...r,
        voteCount: (r.voteCount || 0) + delta,
        upvoterUids: isVoted ? (r.upvoterUids || []).filter(u => u !== uid) : [...(r.upvoterUids || []), uid],
      }),
    }));

    try {
      await updateDoc(
        doc(db, 'mediaDiscussions', mediaKey, 'threads', threadId, 'replies', replyId),
        { voteCount: increment(delta), upvoterUids: isVoted ? arrayRemove(uid) : arrayUnion(uid) },
      );
    } catch (e) {
      console.error('Reply vote failed', e);
    }
  };

  const friendsEmpty = tab === 'friends' && !threadsLoading && threads.length === 0;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>Discussion</span>
          {!threadsLoading && (
            <span className={styles.count}>{threads.length} {threads.length === 1 ? 'thread' : 'threads'}</span>
          )}
        </div>
        <div className={styles.sortTabs}>
          {['All', 'Friends'].map(t => (
            <button
              key={t}
              className={`${styles.sortTab} ${tab === t.toLowerCase() ? styles.sortTabActive : ''}`}
              onClick={() => setTab(t.toLowerCase())}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {authUser && !showComposer && (
        <div className={styles.newPostBar} onClick={() => setShowComposer(true)}>
          <Avatar uid={authUser.uid} photoURL={authPhotoURL} username={currentUsername || authInitials} size="md" />
          <span className={styles.newPostPlaceholder}>Share a take on {mediaTitle}…</span>
        </div>
      )}

      {authUser && showComposer && (
        <div className={styles.composer}>
          <textarea
            className={styles.composerInput}
            rows={1}
            placeholder={`Share a take on ${mediaTitle}…`}
            value={newPostText}
            onChange={e => {
              setNewPostText(e.target.value);
              autoResize(e.target);
            }}
            autoFocus
          />
          <div className={styles.composerActions}>
            <button className={`${styles.actionBtn} ${styles.actionBtnCancel}`} onClick={() => { setShowComposer(false); setNewPostText(''); }}>
              Cancel
            </button>
            <button
              className={`${styles.actionBtn} ${newPostText.trim() ? '' : styles.actionBtnDisabled}`}
              onClick={handlePostThread}
              disabled={!newPostText.trim() || posting}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.threadList}>
        {threadsLoading ? (
          <div className={styles.emptyText}>Loading discussions…</div>
        ) : friendsEmpty ? (
          <div className={styles.emptyText}>
            {followingList.length === 0
              ? 'Follow people to see their takes here.'
              : 'None of the people you follow have posted about this yet.'}
          </div>
        ) : threads.length === 0 ? (
          <div className={styles.emptyText}>No discussions yet. Be the first to share a take!</div>
        ) : threads.map(thread => {
          const isVoted = authUser && (thread.upvoterUids || []).includes(authUser.uid);
          const repliesOpen = openReplies.has(thread.id);
          const threadReplies = repliesData[thread.id] || [];
          const replyComposerOpen = openReplyComposer.has(thread.id);

          return (
            <div key={thread.id} className={styles.thread}>
              <div className={styles.voteCol}>
                <button
                  className={`${styles.voteBtn} ${isVoted ? styles.voteBtnActive : ''}`}
                  onClick={() => handleVoteThread(thread.id)}
                  disabled={!authUser}
                >
                  🥕
                </button>
                <span className={`${styles.voteCount} ${isVoted ? styles.voteCountActive : ''}`}>
                  {thread.voteCount || 0}
                </span>
              </div>

              <div className={styles.threadBody}>
                <div className={styles.threadMeta}>
                  <Avatar uid={thread.uid} photoURL={thread.photoURL} username={thread.username} size="sm" />
                  <span className={styles.threadAuthor}>{thread.username}</span>
                  <span className={styles.threadTime}>{formatTime(thread.createdAt)}</span>
                  {thread.userScore != null && (
                    <span className={styles.ratingBadge}>{thread.userScore}</span>
                  )}
                </div>

                <p className={styles.threadText}>{thread.text}</p>

                <div className={styles.threadActions}>
                  <button className={styles.threadActionBtn} onClick={() => toggleReplies(thread.id)}>
                    <MessageSquare size={13} />
                    {thread.replyCount || 0} {repliesOpen ? '· hide' : 'replies'}
                  </button>
                  {authUser && (
                    <button className={styles.threadActionBtn} onClick={() => openReplyComposerFor(thread.id)}>
                      Reply
                    </button>
                  )}
                </div>

                {repliesOpen && (
                  <div className={styles.repliesWrap}>
                    {threadReplies.map(reply => {
                      const isReplyVoted = authUser && (reply.upvoterUids || []).includes(authUser.uid);
                      return (
                        <div key={reply.id} className={styles.reply}>
                          <div className={styles.replyVoteCol}>
                            <button
                              className={`${styles.replyVoteBtn} ${isReplyVoted ? styles.voteBtnActive : ''}`}
                              onClick={() => handleVoteReply(thread.id, reply.id)}
                              disabled={!authUser}
                            >
                              🥕
                            </button>
                            <span className={`${styles.replyVoteCount} ${isReplyVoted ? styles.voteCountActive : ''}`}>
                              {reply.voteCount || 0}
                            </span>
                          </div>
                          <div className={styles.replyBody}>
                            <div className={styles.replyMeta}>
                              <Avatar uid={reply.uid} photoURL={reply.photoURL} username={reply.username} size="xs" />
                              <span className={styles.replyAuthor}>{reply.username}</span>
                              <span className={styles.replyTime}>{formatTime(reply.createdAt)}</span>
                              {reply.userScore != null && (
                                <span className={`${styles.ratingBadge} ${styles.ratingBadgeSm}`}>{reply.userScore}</span>
                              )}
                            </div>
                            <p className={styles.replyText}>{reply.text}</p>
                            {authUser && (
                              <div className={styles.replyActions}>
                                <button className={styles.replyActionBtn} onClick={() => openReplyComposerFor(thread.id)}>
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {replyComposerOpen && (
                      <div className={styles.replyComposer}>
                        <Avatar uid={authUser?.uid} photoURL={authPhotoURL} username={currentUsername || authInitials} size="xs" />
                        <div className={styles.replyComposerInputWrap}>
                          <textarea
                            className={styles.replyInput}
                            rows={1}
                            placeholder="Add a reply…"
                            value={replyTexts[thread.id] || ''}
                            onChange={e => {
                              setReplyTexts(prev => ({ ...prev, [thread.id]: e.target.value }));
                              autoResize(e.target);
                            }}
                            autoFocus
                          />
                          <div className={styles.replyComposerActions}>
                            <button className={`${styles.actionBtn} ${styles.actionBtnCancel}`} onClick={() => closeReplyComposer(thread.id)}>
                              Cancel
                            </button>
                            <button
                              className={`${styles.actionBtn} ${(replyTexts[thread.id] || '').trim() ? '' : styles.actionBtnDisabled}`}
                              onClick={() => handlePostReply(thread.id)}
                              disabled={!(replyTexts[thread.id] || '').trim() || postingReply[thread.id]}
                            >
                              {postingReply[thread.id] ? 'Posting…' : 'Post'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {threads.length >= 20 && (
        <div className={styles.footer}>
          <button className={styles.loadMoreBtn} onClick={loadThreads}>Load more discussions</button>
        </div>
      )}
    </section>
  );
}
