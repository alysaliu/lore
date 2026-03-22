'use client';

import { useId } from 'react';
import { Info } from 'lucide-react';
import styles from './PasswordSecurityHint.module.css';

export default function PasswordSecurityHint({ children }) {
  const tipId = useId();

  return (
    <div className={styles.passwordFieldWrap}>
      {children}
      <div className={styles.passwordHintHost}>
        <button
          type="button"
          className={styles.passwordHintBtn}
          aria-label="How your password is kept secure"
          aria-describedby={tipId}
        >
          <Info size={18} aria-hidden />
        </button>
        <div id={tipId} role="tooltip" className={styles.passwordTooltip}>
          <p className={styles.tooltipP}>
            Your password is sent over an encrypted connection to Firebase Authentication
            (Google&apos;s sign-in service).
          </p>
          <p className={styles.tooltipP}>
            Lore does not store your password in our database. We cannot see, export, or recover it.
            Firebase keeps only a secure credential so you can sign in again.
          </p>
        </div>
      </div>
    </div>
  );
}
