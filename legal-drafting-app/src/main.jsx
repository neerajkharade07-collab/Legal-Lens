import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './context/AppProviders';
import App from './App';
import './styles/index.css';

// Served under /legal-drafting/ (vite `base`); routes inside the app stay "/", "/documents", …
const basename = window.location.pathname.includes('/legal-drafting/')
  ? window.location.pathname.split('/legal-drafting/')[0] + '/legal-drafting'
  : '/legal-drafting';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
