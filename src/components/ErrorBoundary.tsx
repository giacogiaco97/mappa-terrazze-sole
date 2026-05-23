import { Component, type ReactNode, type ErrorInfo } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Error boundary minimale: cattura errori React e mostra un fallback con
 * pulsante "ricarica". Senza questo, un crash di qualunque componente
 * brucia tutta l'app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log basico — niente analytics. L'utente vedrà comunque il fallback.
    // eslint-disable-next-line no-console
    console.error('App crash:', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: 24,
            maxWidth: 420,
            margin: '40px auto',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Algo ha ido mal</h2>
          <p style={{ color: '#555' }}>
            La aplicación ha encontrado un error inesperado. Intenta recargar la página.
          </p>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 8,
            fontSize: 12,
            overflow: 'auto',
            color: '#900',
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#f5a623', color: '#1a1a1a', border: 0,
              padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
