import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Handler comune per modali a11y:
 * - Escape chiama `onClose`.
 * - Click su `data-modal-backdrop` chiama `onClose`.
 * - Focus trap: Tab e Shift+Tab restano dentro al modal (per default cerca
 *   elementi focusabili in tutta la pagina, ma ne limita la navigazione).
 * - Restore focus: alla chiusura ridà il focus all'elemento che era attivo
 *   prima dell'apertura.
 *
 * Uso:
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useModalDismiss(isOpen, onClose, ref);
 * return isOpen ? <div ref={ref} className="modal-backdrop" data-modal-backdrop>...</div> : null;
 * ```
 *
 * Se `containerRef` non è fornito, il focus trap è disabilitato (utile per
 * "modali" leggeri come la TerraceCard che non sono veri overlay bloccanti).
 */
export function useModalDismiss(
  isOpen: boolean,
  onClose: () => void,
  containerRef?: React.RefObject<HTMLElement | null>,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Salva il focus precedente
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // Focus trap solo se ho un container
      if (e.key !== 'Tab' || !containerRef?.current) return;
      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.dataset && 'modalBackdrop' in target.dataset) onClose();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);

    // Sposta focus al primo elemento focusable del modal
    if (containerRef?.current) {
      const first = containerRef.current.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      // Restore focus all'elemento precedente (se ancora montato)
      const prev = previouslyFocused.current;
      if (prev && document.body.contains(prev)) {
        prev.focus();
      }
    };
  }, [isOpen, onClose, containerRef]);
}
