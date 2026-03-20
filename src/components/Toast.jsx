'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Toast.module.css';

export default function Toast({ message, type = 'success', action, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span className={styles.message}>{message}</span>
      {action && (
        <button className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
      <button className={styles.close} onClick={onClose} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
