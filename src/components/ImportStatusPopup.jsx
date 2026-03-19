'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useImportStatus } from '../contexts/ImportStatusContext';
import styles from './ImportStatusPopup.module.css';

const CLOSE_ANIMATION_MS = 300;

function formatFlowLabel(flow) {
  if (flow === 'letterboxd') return 'Letterboxd import';
  return 'Import';
}

export default function ImportStatusPopup() {
  const { status, dismiss } = useImportStatus();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      dismiss();
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, dismiss]);

  const isVisible = status.state !== 'idle' || isClosing;
  const remaining = Math.max(0, (status.total || 0) - (status.processed || 0));

  const headline = useMemo(() => {
    const label = formatFlowLabel(status.flow);
    if (status.state === 'running') return `${label} in progress`;
    if (status.state === 'done') return `${label} complete`;
    if (status.state === 'error') return `${label} failed`;
    return label;
  }, [status.flow, status.state]);

  if (!isVisible) return null;

  const wrapClass = [styles.wrap, isClosing && styles.wrapClosing].filter(Boolean).join(' ');

  return (
    <div className={wrapClass} role="region" aria-label="Import status">
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{headline}</span>
              {status.state === 'running' && (
                <span className={styles.pill} aria-label="Import running">
                  Running
                </span>
              )}
              {status.state === 'done' && (
                <span className={styles.pillDone} aria-label="Import complete">
                  Done
                </span>
              )}
              {status.state === 'error' && (
                <span className={styles.pillError} aria-label="Import failed">
                  Error
                </span>
              )}
            </div>
            <div className={styles.subtitle}>
              {status.state === 'running' ? (
                <>
                  {status.processed}/{status.total} processed · {remaining} left
                </>
              ) : (
                <>
                  {status.total ? `${status.total} total` : 'Summary'}
                </>
              )}
            </div>
          </div>

          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Dismiss import status" disabled={isClosing}>
            <ChevronDown size={20} />
          </button>
        </div>

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
          <div className={styles.metric} data-kind="left">
            <div className={styles.metricLabel}>Left</div>
            <div className={styles.metricValue}>{status.state === 'running' ? remaining : 0}</div>
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

        <div className={styles.flowLine}>
          Flow: open Settings → Account → Import → select folder → import runs movie-by-movie and updates your ratings.
        </div>
      </div>
    </div>
  );
}

