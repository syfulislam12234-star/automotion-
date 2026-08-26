import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  const fallbackElement = document.createElement('main');
  fallbackElement.style.cssText = 'min-height:100vh;display:grid;place-items:center;background:#020617;color:#e2e8f0;font:16px system-ui,sans-serif;padding:24px;text-align:center;';
  fallbackElement.textContent = 'The application root is unavailable. Please refresh the page.';
  document.body.appendChild(fallbackElement);
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
