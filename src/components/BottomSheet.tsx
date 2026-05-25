import { useEffect, useRef, useState } from 'react';
import '../styles/bottom-sheet.css';

type Props = {
  collapsedLabel: string;
  children: React.ReactNode;
  /**
   * Modalità controlled (mobile drawer): se definito, il sheet diventa un
   * drawer laterale aperto/chiuso da fuori (es. tramite FAB). Lasciare
   * undefined per il comportamento legacy bottom-sheet espandibile.
   */
  open?: boolean;
  onClose?: () => void;
};

export default function BottomSheet({ collapsedLabel, children, open, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const isControlled = open !== undefined;

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0]!.clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0]!.clientY - startY.current;
    setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY < -40) setExpanded(true);
    if (dragY > 40) setExpanded(false);
    startY.current = null;
    setDragY(0);
  };

  useEffect(() => { setDragY(0); }, [expanded]);

  // Drawer mobile: ESC chiude
  useEffect(() => {
    if (!isControlled || !open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isControlled, open, onClose]);

  const drawerCls = isControlled
    ? `bottom-sheet--drawer ${open ? 'bottom-sheet--open' : ''}`
    : '';

  return (
    <>
      {isControlled && open && onClose && (
        <div
          className="bottom-sheet-backdrop"
          data-modal-backdrop
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`bottom-sheet ${expanded ? 'bottom-sheet--expanded' : ''} ${drawerCls}`}
        style={!isControlled && dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <button
          className="bottom-sheet__handle"
          onClick={() => isControlled ? onClose?.() : setExpanded((v) => !v)}
          onTouchStart={isControlled ? undefined : onTouchStart}
          onTouchMove={isControlled ? undefined : onTouchMove}
          onTouchEnd={isControlled ? undefined : onTouchEnd}
          aria-label={isControlled ? `${collapsedLabel} — toca para cerrar` : collapsedLabel}
          aria-expanded={isControlled ? open : expanded}
        >
          <span className="bottom-sheet__bar" aria-hidden="true" />
          <span className="bottom-sheet__label" aria-live="polite">{collapsedLabel}</span>
        </button>
        <div className="bottom-sheet__content">{children}</div>
      </aside>
    </>
  );
}
