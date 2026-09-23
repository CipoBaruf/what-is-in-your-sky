import { Component, type ErrorInfo, type ReactNode } from 'react';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import styles from './RootBoundary.module.css';

/**
 * R91 (FR-FAIL-5, D-544, F-88): a render error is a page, never a blank one.
 * The boundary sits outside everything `AppRoot` renders — the language
 * provider included — so it can use nothing that could itself have thrown:
 * plain elements, no store, no hook, no lazy component. Its four strings (the
 * header's title, the sentence, `[ reload ]`, `[ details ]`) come straight from
 * the two catalogs, in the language `applyLocale` last wrote to `<html lang>`,
 * English when that is anything else. `[ reload ]` is `location.reload()`;
 * `[ details ]` is a native `<details>`, which needs no state, holding the
 * error's name, message and component stack as copyable monospace text
 * (FR-FAIL-2).
 */
export interface RootBoundaryProps {
  children: ReactNode;
}

interface RootBoundaryState {
  error: unknown;
  stack: string;
}

function words() {
  const catalog = typeof document !== 'undefined' && document.documentElement.lang === 'es' ? es : en;
  return { title: catalog.app.title, ...catalog.boundary };
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export class RootBoundary extends Component<RootBoundaryProps, RootBoundaryState> {
  override state: RootBoundaryState = { error: null, stack: '' };

  static getDerivedStateFromError(error: unknown): Partial<RootBoundaryState> {
    return { error: error ?? new Error('unknown') };
  }

  override componentDidCatch(_error: unknown, info: ErrorInfo): void {
    this.setState({ stack: info.componentStack ?? '' });
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    const w = words();
    return (
      <div className={styles.page} data-testid="root-boundary">
        <header className={styles.header}>
          <p className={styles.title}>{w.title}</p>
        </header>
        <main className={styles.main}>
          <h1 className={styles.sentence}>{w.sentence}</h1>
          <p className={styles.actions}>
            <button
              type="button"
              className={styles.reload}
              data-testid="boundary-reload"
              onClick={() => {
                window.location.reload();
              }}
            >
              {w.reload}
            </button>
          </p>
          <details className={styles.details}>
            <summary data-testid="boundary-details">{w.details}</summary>
            <pre className={styles.detail} data-testid="boundary-detail">
              {describe(this.state.error)}
              {this.state.stack}
            </pre>
          </details>
        </main>
      </div>
    );
  }
}
