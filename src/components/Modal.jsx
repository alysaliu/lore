import { X, ArrowLeft } from 'lucide-react';
import styles from './Modal.module.css';

/**
 * Generic modal component.
 *
 * Props:
 *   title      — string shown in the header
 *   onClose    — called when backdrop or X is clicked
 *   onBack     — if provided, shows a back arrow button on the left of the header
 *   maxWidth   — CSS value for max-width of the modal panel (default: '400px')
 *   actions    — array of { label, onClick, disabled, variant }
 *                variant: 'primary' (default) | 'secondary'
 *   children   — modal body content
 */
export default function Modal({ title, onClose, onBack, maxWidth = '400px', actions = [], children }) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {children}

        {actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map(({ label, onClick, disabled, variant = 'primary' }) => (
              <button
                key={label}
                className={variant === 'secondary' ? styles.secondaryBtn : styles.primaryBtn}
                onClick={onClick}
                disabled={disabled}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
