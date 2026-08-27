import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<main style="padding: 2rem; color: white; background: #020617; font-family: sans-serif"><h1>Workspace unavailable</h1><p>The application mount point is missing. Reload the page to try again.</p></main>';
} else {
  ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
  );
}
