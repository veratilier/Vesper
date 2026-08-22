import React from 'react';
import { createRoot } from 'react-dom/client';
import './app/globals.css';
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
