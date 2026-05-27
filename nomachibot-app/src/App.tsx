import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { init, retrieveLaunchParams } from '@telegram-apps/sdk';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { CreateContract } from './pages/CreateContract';
import { ContractDetail } from './pages/ContractDetail';
import { ConfirmContract } from './pages/ConfirmContract';


// ─── Dashboard ───────────────────────────────────────────────
interface ContractSummary {
  uuid: string;
  status: string;
  total_amount: string | number;
  currency: string;
  n_months: number;
  myRole: string;
  participants: { role: string; first_name: string | null; last_name: string | null }[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [contracts, setContracts] = useState<{
    borrowing: ContractSummary[];
    lending: ContractSummary[];
    witnessing: ContractSummary[];
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.get('/api/contracts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setContracts(r.data))
      .catch(() => {});
  }, []);

  const allContracts: ContractSummary[] = contracts
    ? [...contracts.borrowing, ...contracts.lending, ...contracts.witnessing]
    : [];

  const statusColor = (s: string) =>
    s === 'active' ? 'text-green-500' : s === 'settled' ? 'text-blue-400' : 'text-yellow-400';

  const roleLabel = (role: string) => {
    if (role === 'borrower') return t('borrower', 'Borrower');
    if (role === 'lender') return t('lender', 'Lender');
    return t('witness', 'Witness');
  };

  const counterparty = (c: ContractSummary) => {
    if (c.myRole === 'borrower') {
      const l = c.participants.find(p => p.role === 'lender');
      return l ? `${l.first_name || ''} ${l.last_name || ''}`.trim() : '—';
    }
    const b = c.participants.find(p => p.role === 'borrower');
    return b ? `${b.first_name || ''} ${b.last_name || ''}`.trim() : '—';
  };

  return (
    <div className="min-h-screen flex flex-col bg-tg-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-tg-secondaryBg">
        <h1 className="text-lg font-bold text-tg-text">NomachiBot</h1>
        <select
          className="bg-tg-secondaryBg text-tg-text text-sm px-2 py-1 rounded-lg outline-none"
          value={i18n.language}
          onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('appLang', e.target.value); }}
        >
          <option value="en">EN</option>
          <option value="uz">UZ</option>
          <option value="ru">RU</option>
        </select>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24 max-w-lg mx-auto w-full">
        <button
          onClick={() => navigate('/create')}
          className="w-full py-4 rounded-2xl font-bold text-lg mb-5 transition-all active:scale-95"
          style={{ backgroundColor: 'var(--tg-theme-button-color, #3390ec)', color: 'var(--tg-theme-button-text-color, #fff)' }}
        >
          + {t('createContract', 'Create Contract')}
        </button>

        {allContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-12 text-center">
            <div className="w-20 h-20 rounded-full bg-tg-link/10 flex items-center justify-center mb-4">
              <span className="text-4xl">📝</span>
            </div>
            <p className="text-tg-hint text-sm max-w-xs">{t('dashboardHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-tg-hint font-medium uppercase tracking-wide mb-2">Your Contracts</p>
            {allContracts.map(c => (
              <button
                key={c.uuid}
                onClick={() => navigate(`/contract/${c.uuid}`)}
                className="w-full bg-tg-secondaryBg rounded-2xl px-4 py-3 flex items-center justify-between text-left active:opacity-70"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-tg-hint">{roleLabel(c.myRole)}</span>
                    <span className={`text-xs font-medium ${statusColor(c.status)}`}>· {c.status}</span>
                  </div>
                  <p className="text-tg-text text-sm font-medium truncate">
                    {Number(c.total_amount).toLocaleString()} {c.currency}
                    <span className="text-tg-hint font-normal"> · {c.n_months}mo</span>
                  </p>
                  <p className="text-tg-hint text-xs truncate">{counterparty(c)}</p>
                </div>
                <span className="text-tg-hint ml-2">›</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};


// ─── App Content (auth + routing) ───────────────────────────
const AppContent = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const authenticate = async () => {
      try {
        // ── Step 1: window.Telegram.WebApp (works on all Telegram clients)
        const tgWebApp = (window as any).Telegram?.WebApp;
        let initDataRaw: string | undefined;
        let startParam: string | undefined;

        if (tgWebApp) {
          tgWebApp.ready();   // tell Telegram the app has loaded
          tgWebApp.expand();  // expand to full height
          // initData can be "" in some edge cases — treat that as missing
          initDataRaw = tgWebApp.initData || undefined;
          startParam = tgWebApp.initDataUnsafe?.start_param;
        }

        // ── Step 2: @telegram-apps/sdk fallback (newer clients / web)
        if (!initDataRaw) {
          try {
            init();
            const params = retrieveLaunchParams();
            initDataRaw = (params.initDataRaw as string | undefined) || undefined;
            if (!startParam) {
              const sdkData = params.initData as any;
              startParam = sdkData?.startParam ?? sdkData?.start_param;
            }
          } catch (e) {
            console.log('SDK retrieveLaunchParams also failed:', e);
          }
        }

        // ── Step 3: handle invite-link navigation
        if (startParam) {
          const parts = String(startParam).split('_');
          if (parts.length === 3) {
            const [uuid, role, token] = parts;
            navigate(`/confirm/${uuid}/${role}/${token}`);
          }
        }

        // ── Step 4: authenticate or restore session
        if (initDataRaw) {
          try {
            const res = await axios.post('/api/auth/telegram', { initData: initDataRaw });
            localStorage.setItem('token', res.data.token);
            setIsReady(true);
          } catch (authErr) {
            console.error('Auth failed:', authErr);
            if (localStorage.getItem('token')) {
              setIsReady(true);
            } else {
              setError('Authentication failed. Please try reopening the app.');
            }
          }
        } else if (localStorage.getItem('token')) {
          setIsReady(true);
        } else if (tgWebApp !== undefined) {
          // We ARE inside Telegram but initData is empty — unusual production edge case
          setError('No auth data received from Telegram. Please close and reopen the app.');
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
        {/* /confirm handled at root level — no auth needed, invite token validates */}
      </Routes>
    </div>
  );
};

// ─── Root ────────────────────────────────────────────────────
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* /confirm uses invite token auth — no Telegram initData needed */}
        <Route path="/confirm/:uuid/:role/:token" element={<ConfirmContract />} />
        {/* Everything else requires Telegram auth */}
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
