import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { TerminalProvider } from './contexts/TerminalContext';
import { LanguageProvider } from './contexts/LanguageContext';

const hideBootSplash = () => {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 260);
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <LanguageProvider>
    <TerminalProvider>
      <App />
    </TerminalProvider>
  </LanguageProvider>
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideBootSplash();
  });
});
