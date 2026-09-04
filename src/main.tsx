import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyLocale } from './i18n/useT';
import { appStore, startApp } from './state';
import { AppRoot } from './ui/App';
import { applyTheme } from './ui/styles/theme';
import './ui/styles/tokens.css';
import './ui/styles/global.css';

/**
 * D-70 (R17, R20): the language and the theme are applied before the first
 * render, not by an inline script — `script-src 'self'` (PLAN §11) forbids
 * one, and the app is client-rendered anyway. `startApp` creates the store,
 * whose prefs slice has already resolved the locale from `wiys:prefs:v1` and
 * `navigator.languages` (FR-I18N-1) and read the saved theme (FR-THEME-1);
 * `applyLocale` sets `documentElement.lang` and the document title
 * (FR-I18N-5) and `applyTheme` sets `data-theme`, and only then does anything
 * paint, so no frame is composited in the wrong palette. `AppRoot` keeps both
 * on the current choice for every later switch.
 */
startApp();
applyLocale(appStore.getState().locale);
applyTheme(appStore.getState().theme);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
createRoot(root).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
