import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyLocale } from './i18n/useT';
import { appStore, startApp } from './state';
import { AppRoot } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/global.css';

/**
 * D-70 (R17): the language is applied before the first render, not by an
 * inline script — `script-src 'self'` (PLAN §11) forbids one, and the app is
 * client-rendered anyway. `startApp` creates the store, whose prefs slice has
 * already resolved the locale from `wiys:prefs:v1` and `navigator.languages`
 * (FR-I18N-1); `applyLocale` sets `documentElement.lang` and the document
 * title from it (FR-I18N-5), and only then does anything paint. The provider
 * inside `AppRoot` keeps both on the language for every later switch.
 */
startApp();
applyLocale(appStore.getState().locale);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
createRoot(root).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
