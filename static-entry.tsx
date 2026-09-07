import React from 'react';
import { createRoot } from 'react-dom/client';
import './app/globals.css';
import './app/chat.css';
import './app/music.css';
import './app/settings.css';
import './app/theme.css';
import './app/home.css';
import './app/memory.css';
import './app/stickers.css';
import './app/typography.css';
import './app/refinement.css';
import './app/anniversary.css';
import './app/home-cards.css';
import App from './app/page';

const root = document.getElementById('root');
if (!root) throw new Error('Vesper root element is missing');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
