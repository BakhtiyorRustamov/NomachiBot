import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { initMiniApp, initUtils, initInitData } from '@telegram-apps/sdk';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

import { CreateContract } from './pages/CreateContract';

// Placeholder Pages
const Dashboard = () => <div className="p-4"><h1>Dashboard</h1><p>Welcome to NomachiBot</p></div>;
const ContractDetail = () => <div className="p-4"><h1>Contract Detail</h1></div>;
const ConfirmContract = () => <div className="p-4"><h1>Confirm Contract</h1></div>;

const AppContent = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      // Initialize Telegram Mini App SDK
      const [miniApp] = initMiniApp();
      miniApp.ready();
      
      const utils = initUtils();
      const initData = initInitData();

      // Check for startParam (Invite Link)
      const startParam = initData?.startParam;
      if (startParam) {
        // Format: {uuid}_{role}_{token}
        const parts = startParam.split('_');
        if (parts.length === 3) {
          const [uuid, role, token] = parts;
          navigate(`/confirm/${uuid}/${role}/${token}`);
        }
      }

      // Perform Authentication against our backend
      if (initData) {
        const initDataRaw = initData.raw;
        // In a real scenario, we'd send initDataRaw to our API
        // axios.post('http://localhost:3001/api/auth/telegram', { initData: initDataRaw })
        //   .then(res => { localStorage.setItem('token', res.data.token); setIsReady(true); })
        //   .catch(err => setError('Authentication failed'));
        setIsReady(true); // Mock success for now
      } else {
        setError('Please open this app inside Telegram');
      }

    } catch (e: any) {
      console.error(e);
      setError('Failed to initialize Telegram SDK. ' + e.message);
    }
  }, [navigate]);

  if (error) {
    return <div className="p-4 text-red-500 bg-red-100/10 rounded-lg m-4">{error}</div>;
  }

  if (!isReady) {
    return <div className="p-4 text-center mt-10">Loading NomachiBot...</div>;
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

const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
