import { useEffect, useRef, useState } from 'react';
import '../styles/bottom-sheet.css';

type Props = {
  collapsedLabel: string;
  children: React.ReactNode;
};

export default function BottomSheet({ collapsedLabel, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

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

  return (
    <div
      className={`bottom-sheet ${expanded ? 'bottom-sheet--expanded' : ''}`}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <button
        className="bottom-sheet__handle"
        onClick={() => setExpanded((v) => !v)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="toggle sheet"
      >
        <span className="bottom-sheet__bar" />
        <span className="bottom-sheet__label">{collapsedLabel}</span>
      </button>
      <div className="bottom-sheet__content">{children}</div>
    </div>
  );
}
