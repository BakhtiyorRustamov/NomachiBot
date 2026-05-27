import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import './i18n';
import axios from 'axios';
import { PublicStatus } from './pages/PublicStatus';

axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/status/:uuid" element={<PublicStatus />} />
        <Route path="*" element={<PublicStatus />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
