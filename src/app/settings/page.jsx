'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  parseRatingsCsv,
  importLetterboxdRatings,
} from '../../lib/letterboxdImport';
import styles from './page.module.css';

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'dev', label: '[Dev-Only]' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('account');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [summarySections, setSummarySections] = useState({
    success: true,
    skipped: true,
    failed: true,
  });
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [showDeleteRatingsConfirm, setShowDeleteRatingsConfirm] = useState(false);
  const [deletingRatings, setDeletingRatings] = useState(false);
  const fileInputRef = useRef(null);

  const toggleSummarySection = (key) => {
    setSummarySections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const username = userSnap.exists() ? userSnap.data().username : null;
      if (!username) return;
      const usernameSnap = await getDoc(doc(db, 'usernames', username));
      if (usernameSnap.exists() && usernameSnap.data().isDeveloper) {
        setIsDeveloper(true);
      }
    })();
  }, [user]);

  const readFileFromDirectory = async (dirHandle, name) => {
    try {
      const fileHandle = await dirHandle.getFileHandle(name);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  };

  const runImport = async (csvText) => {
    if (!user || !csvText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const rows = parseRatingsCsv(csvText);
      if (rows.length === 0) {
        setImportResult({
          successful: 0,
          skipped: 0,
          failed: 0,
          details: [],
          error: 'No valid rows in ratings.csv. Expected columns: Date, Name, Year, Letterboxd URI, Rating',
        });
        setImporting(false);
        return;
      }
      const result = await importLetterboxdRatings(user.uid, rows);
      setImportResult(result);
    } catch (err) {
      setImportResult({
        successful: 0,
        skipped: 0,
        failed: 0,
        details: [],
        error: err?.message || 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportClick = async () => {
    if (!user || importing) return;
    if (typeof window === 'undefined') return;

    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const csvText = await readFileFromDirectory(dirHandle, 'ratings.csv');
        if (!csvText) {
          setImportResult({
            successful: 0,
            skipped: 0,
            failed: 0,
            details: [],
            error: 'ratings.csv not found in the selected folder. Export your data from Letterboxd and choose that folder.',
          });
          setImporting(false);
          return;
        }
        await runImport(csvText);
      } catch (err) {
        if (err.name === 'AbortError') {
          setImporting(false);
          return;
        }
        setImportResult({
          successful: 0,
          skipped: 0,
          failed: 0,
          details: [],
          error: err?.message || 'Could not read folder',
        });
        setImporting(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') await runImport(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteAllRatings = async () => {
    if (!user) return;
    setDeletingRatings(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { ratings: {}, ratingCount: 0 });
      setShowDeleteRatingsConfirm(false);
    } catch (err) {
      console.error('Failed to delete ratings', err);
    } finally {
      setDeletingRatings(false);
    }
  };

  if (loading) return null;
  if (!user) return null;

  const hasResult = importResult && !importResult.error;
  const hasError = importResult?.error;

  return (
    <div className={styles.settingsSection}>
      <div className={styles.settingsContainer}>
        <nav className={styles.sidebar} aria-label="Settings sections">
          <ul className={styles.sidebarList}>
            {SECTIONS.filter(({ id }) => id !== 'dev' || isDeveloper).map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  className={`${styles.sidebarTab} ${activeSection === id ? styles.sidebarTabActive : ''}`}
                  onClick={() => setActiveSection(id)}
                  aria-current={activeSection === id ? 'true' : undefined}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.content}>
          {activeSection === 'account' && (
            <section className={styles.panel} aria-labelledby="account-heading">
              <h2 id="account-heading" className={styles.panelTitle}>Account</h2>
              <p className={styles.panelDescription}>
                Manage your account and sign-in options.
              </p>
              <div className={styles.panelBody}>
                <div className={styles.settingBlock}>
                  <h3 className={styles.settingBlockTitle}>Import</h3>
                  <p className={styles.settingBlockDescription}>
                    Bring your ratings and watch history from Letterboxd. Choose the folder that contains your Letterboxd export (it should include ratings.csv).
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className={styles.hiddenFileInput}
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={handleImportClick}
                    disabled={importing}
                  >
                    {importing ? 'Importing…' : 'Import from Letterboxd'}
                  </button>

                  {hasError && (
                    <div className={styles.importError} role="alert">
                      {importResult.error}
                    </div>
                  )}

                  {hasResult && (
                    <div className={styles.importSummary}>
                      <p className={styles.importSummaryTitle}>Import complete</p>
                      <p className={styles.importSummaryCounts}>
                        <span className={styles.importCountSuccess}>{importResult.successful} successful</span>
                        {' · '}
                        <span className={styles.importCountSkipped}>{importResult.skipped} skipped</span>
                        {' · '}
                        <span className={styles.importCountFailed}>{importResult.failed} failed</span>
                      </p>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                        setSummarySections({ success: true, skipped: true, failed: true });
                        setShowDetailsModal(true);
                      }}
                      >
                        View import summary
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
          {activeSection === 'dev' && isDeveloper && (
            <section className={styles.panel} aria-labelledby="dev-heading">
              <h2 id="dev-heading" className={styles.panelTitle}>[Dev-Only]</h2>
              <p className={styles.panelDescription}>
                Developer-only tools. Use with care.
              </p>
              <div className={styles.panelBody}>
                <div className={styles.settingBlock}>
                  <h3 className={styles.settingBlockTitle}>Delete all ratings</h3>
                  <p className={styles.settingBlockDescription}>
                    Permanently remove every movie and show rating from your account. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => setShowDeleteRatingsConfirm(true)}
                  >
                    Delete all ratings
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {showDetailsModal && hasResult && (() => {
        const successItems = importResult.details.filter((d) => d.status === 'success');
        const skippedItems = importResult.details.filter((d) => d.status === 'skipped');
        const failedItems = importResult.details.filter((d) => d.status === 'failed');
        return (
          <div
            className={styles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-summary-title"
            onClick={() => setShowDetailsModal(false)}
          >
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2 id="import-summary-title" className={styles.modalTitle}>
                  Import summary
                </h2>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowDetailsModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                {successItems.length > 0 && (
                  <div className={styles.summarySection}>
                    <button
                      type="button"
                      className={styles.summarySectionHeader}
                      onClick={() => toggleSummarySection('success')}
                      aria-expanded={summarySections.success}
                    >
                      <span className={styles.summarySectionChevron}>
                        {summarySections.success ? '▼' : '▶'}
                      </span>
                      <span className={styles.summarySectionTitleSuccess}>
                        Successful imports ({successItems.length})
                      </span>
                    </button>
                    {summarySections.success && (
                      <div className={styles.detailsListWrapper}>
                        <div className={styles.detailsListHeader}>
                          <span>Titles</span>
                          <span>Status</span>
                        </div>
                        <ul className={styles.detailsList}>
                          {successItems.map((item, i) => (
                            <li key={`s-${i}`} className={styles.detailsItem} data-status="success">
                              <span className={styles.detailsTitle}>{item.title}</span>
                              <span className={styles.detailsStatus}>Imported</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {skippedItems.length > 0 && (
                  <div className={styles.summarySection}>
                    <button
                      type="button"
                      className={styles.summarySectionHeader}
                      onClick={() => toggleSummarySection('skipped')}
                      aria-expanded={summarySections.skipped}
                    >
                      <span className={styles.summarySectionChevron}>
                        {summarySections.skipped ? '▼' : '▶'}
                      </span>
                      <span className={styles.summarySectionTitleSkipped}>
                        Skipped imports ({skippedItems.length})
                      </span>
                    </button>
                    {summarySections.skipped && (
                      <div className={styles.detailsListWrapper}>
                        <div className={styles.detailsListHeader}>
                          <span>Titles</span>
                          <span>Status</span>
                        </div>
                        <ul className={styles.detailsList}>
                          {skippedItems.map((item, i) => (
                            <li key={`k-${i}`} className={styles.detailsItem} data-status="skipped">
                              <span className={styles.detailsTitle}>{item.title}</span>
                              <span className={styles.detailsStatus}>{item.reason || 'Skipped'}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {failedItems.length > 0 && (
                  <div className={styles.summarySection}>
                    <button
                      type="button"
                      className={styles.summarySectionHeader}
                      onClick={() => toggleSummarySection('failed')}
                      aria-expanded={summarySections.failed}
                    >
                      <span className={styles.summarySectionChevron}>
                        {summarySections.failed ? '▼' : '▶'}
                      </span>
                      <span className={styles.summarySectionTitleFailed}>
                        Failed imports ({failedItems.length})
                      </span>
                    </button>
                    {summarySections.failed && (
                      <div className={styles.detailsListWrapper}>
                        <div className={styles.detailsListHeader}>
                          <span>Titles</span>
                          <span>Status</span>
                        </div>
                        <ul className={styles.detailsList}>
                          {failedItems.map((item, i) => (
                            <li key={`f-${i}`} className={styles.detailsItem} data-status="failed">
                              <span className={styles.detailsTitle}>{item.title}</span>
                              <span className={styles.detailsStatus}>{item.reason || 'Failed'}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showDeleteRatingsConfirm && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ratings-confirm-title"
          onClick={() => !deletingRatings && setShowDeleteRatingsConfirm(false)}
        >
          <div
            className={styles.confirmModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="delete-ratings-confirm-title" className={styles.modalTitle}>
                Are you sure?
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !deletingRatings && setShowDeleteRatingsConfirm(false)}
                aria-label="Close"
                disabled={deletingRatings}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.confirmModalDescription}>
                This will permanently delete all your ratings—every movie and show you&apos;ve rated will be removed from your account. This action cannot be undone.
              </p>
              <div className={styles.confirmModalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setShowDeleteRatingsConfirm(false)}
                  disabled={deletingRatings}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={handleDeleteAllRatings}
                  disabled={deletingRatings}
                >
                  {deletingRatings ? 'Deleting…' : 'Delete all ratings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
