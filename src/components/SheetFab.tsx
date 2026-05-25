import '../styles/sheet-fab.css';

type Props = {
  onClick: () => void;
  label: string;
  count: number;
  visible: boolean;
};

/**
 * Floating Action Button per aprire il drawer laterale della lista terrazze
 * su mobile. Mostra l'icona + un badge con il conteggio di terrazze al sole.
 * Su desktop ≥1024px è nascosto via CSS (la sidebar è sempre visibile).
 */
export default function SheetFab({ onClick, label, count, visible }: Props) {
  return (
    <button
      type="button"
      className={`sheet-fab ${visible ? '' : 'sheet-fab--hidden'}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span className="sheet-fab__icon" aria-hidden="true">☀️</span>
      <span className="sheet-fab__count">{count}</span>
    </button>
  );
}
