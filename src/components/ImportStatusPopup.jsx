'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import Link from 'next/link';
import { useImportStatus } from '../contexts/ImportStatusContext';
import styles from './ImportStatusPopup.module.css';

const CLOSE_ANIMATION_MS = 300;

export default function ImportStatusPopup() {
  const { status, dismiss } = useImportStatus();
  const [isClosing, setIsClosing] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      dismiss();
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, dismiss]);

  const isVisible = status.state !== 'idle' || isClosing;

  if (!isVisible) return null;

  const wrapClass = [styles.wrap, isClosing && styles.wrapClosing].filter(Boolean).join(' ');

  return (
    <div className={wrapClass} role="region" aria-label="Import status">
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <span className={styles.title}>Letterboxd Import</span>
              {status.state === 'running' && (
                <span className={styles.pill} aria-label="Import running">Running</span>
              )}
              {status.state === 'done' && (
                <span className={styles.pillDone} aria-label="Import complete">Done</span>
              )}
              {status.state === 'error' && (
                <span className={styles.pillError} aria-label="Import failed">Error</span>
              )}
            </div>
            {!minimized && (
              <div className={styles.subtitle}>
                {status.state === 'running'
                  ? <>{status.processed}/{status.total} processed</>
                  : <>{status.total ? `${status.total} total` : 'Summary'}</>
                }
              </div>
            )}
          </div>

          <div className={styles.btnGroup}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setMinimized((v) => !v)}
              aria-label={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleClose}
              aria-label="Close"
              disabled={isClosing}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {status.state === 'running' && (
              <p className={styles.exploreNote}>Feel free to continue exploring while this runs.</p>
            )}

            <div className={styles.bodyRow}>
              <div className={styles.metric} data-kind="success">
                <div className={styles.metricLabel}>Successful</div>
                <div className={styles.metricValue}>{status.successful || 0}</div>
              </div>
              <div className={styles.metric} data-kind="skipped">
                <div className={styles.metricLabel}>Skipped</div>
                <div className={styles.metricValue}>{status.skipped || 0}</div>
              </div>
              <div className={styles.metric} data-kind="failed">
                <div className={styles.metricLabel}>Failed</div>
                <div className={styles.metricValue}>{status.failed || 0}</div>
              </div>
            </div>

            {status.lastTitle && status.state === 'running' && (
              <div className={styles.lastLine} title={status.lastTitle}>
                Currently: <span className={styles.lastTitle}>{status.lastTitle}</span>
              </div>
            )}

            {status.state === 'error' && status.error && (
              <div className={styles.errorLine} role="alert">
                {status.error}
              </div>
            )}

            <Link href="/settings?tab=data" className={styles.settingsLink}>
              View in Settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
