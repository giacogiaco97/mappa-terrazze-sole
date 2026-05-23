import { useEffect } from 'react';

/**
 * Handler comune per modali: Escape e click sul backdrop chiamano `onClose`.
 * Aggancia listener su document; rimuove on cleanup.
 *
 * Uso:
 * ```tsx
 * useModalDismiss(isOpen, onClose);
 * return isOpen ? <div className="modal-backdrop" data-modal-backdrop>...</div> : null;
 * ```
 *
 * Il click sul backdrop è gestito tramite `data-modal-backdrop`: aggiungilo
 * all'elemento overlay (non al contenuto interno del modal).
 */
export function useModalDismiss(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.dataset && 'modalBackdrop' in target.dataset) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [isOpen, onClose]);
}
