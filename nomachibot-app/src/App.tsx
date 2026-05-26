import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { init, retrieveLaunchParams } from '@telegram-apps/sdk';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { CreateContract } from './pages/CreateContract';
import { ConfirmContract } from './pages/ConfirmContract';

// ─── Dashboard ───────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-tg-secondaryBg">
        <h1 className="text-lg font-bold text-tg-text">NomachiBot</h1>
        <select
          className="bg-tg-secondaryBg text-tg-text text-sm px-2 py-1 rounded-lg outline-none"
          value={i18n.language}
          onChange={(e) => {
            i18n.changeLanguage(e.target.value);
            localStorage.setItem('appLang', e.target.value);
          }}
        >
          <option value="en">EN</option>
          <option value="uz">UZ</option>
          <option value="ru">RU</option>
        </select>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-tg-link/15 flex items-center justify-center mb-6">
          <span className="text-5xl">📝</span>
        </div>

        <h2 className="text-2xl font-bold text-tg-text mb-2 text-center">
          {t('dashboardTitle', 'Welcome to NomachiBot')}
        </h2>
        <p className="text-tg-hint text-center text-sm mb-10 max-w-xs leading-relaxed">
          {t('dashboardSubtitle', 'Create, countersign, and publicly track zero-interest P2P debt agreements entirely inside Telegram.')}
        </p>

        {/* Create Contract button */}
        <button
          onClick={() => navigate('/create')}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-lg transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
            color: 'var(--tg-theme-button-text-color, #ffffff)',
          }}
        >
          + {t('createContract', 'Create Contract')}
        </button>

        {/* Empty state hint */}
        <p className="text-tg-hint text-xs mt-6 text-center max-w-xs">
          {t('dashboardHint', 'Tap the button above to create your first debt agreement. You\'ll be able to invite the lender and witnesses via Telegram.')}
        </p>
      </main>
    </div>
  );
};

// ─── Placeholder pages (Phase 5+) ──────────────────────────
const ContractDetail = () => <div className="p-4"><h1 className="text-xl font-bold text-tg-text">Contract Detail</h1><p className="text-tg-hint mt-2">Coming in Phase 5</p></div>;

// ─── App Content (auth + routing) ───────────────────────────
const AppContent = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const authenticate = async () => {
      try {
        // Initialize Telegram Mini App SDK v3
        init();

        let initData: any = null;
        let initDataRaw: string | undefined;

        // Try the @telegram-apps/sdk first; fall back to window.Telegram.WebApp
        try {
          const params = retrieveLaunchParams();
          initData = params.initData;
          initDataRaw = params.initDataRaw as string | undefined;
        } catch (e) {
          console.log('SDK retrieveLaunchParams failed, trying window.Telegram.WebApp');
        }

        // Fallback: Telegram Desktop / older clients expose initData on window directly
        if (!initDataRaw) {
          const tgWebApp = (window as any).Telegram?.WebApp;
          if (tgWebApp?.initData) {
            initDataRaw = tgWebApp.initData as string;
            // Parse startParam from initData string manually
            const raw = new URLSearchParams(initDataRaw);
            try { initData = { startParam: raw.get('start_param') ?? undefined }; } catch {}
          }
        }

        // Check for startParam (Invite Link)
        const startParam = initData?.startParam ?? (initData as any)?.start_param;
        if (startParam) {
          const parts = String(startParam).split('_');
          if (parts.length === 3) {
            const [uuid, role, token] = parts;
            navigate(`/confirm/${uuid}/${role}/${token}`);
          }
        }

        // Authenticate against the live backend
        if (initDataRaw) {
          try {
            const res = await axios.post('/api/auth/telegram', { initData: initDataRaw });
            localStorage.setItem('token', res.data.token);
            setIsReady(true);
          } catch (authErr) {
            console.error('Auth failed:', authErr);
            // If auth fails, still show UI (token might already be stored)
            if (localStorage.getItem('token')) {
              setIsReady(true);
            } else {
              setError('Authentication failed. Please try reopening the app.');
            }
          }
        } else if (localStorage.getItem('token')) {
          // Already have a token from a previous session
          setIsReady(true);
        } else {
          setError('Please open this app inside Telegram.');
        }
      } catch (e: any) {
        console.error(e);
        setError('Failed to initialize. ' + e.message);
      }
    };

    authenticate();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center max-w-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-tg-link/30 border-t-tg-link rounded-full animate-spin mb-4" />
        <p className="text-tg-hint text-sm">Loading NomachiBot...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateContract />} />
        <Route path="/contract/:uuid" element={<ContractDetail />} />
        <Route path="/confirm/:uuid/:role/:token" element={<ConfirmContract />} />
      </Routes>
    </div>
  );
};

// ─── Root ────────────────────────────────────────────────────
const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
