import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { init, retrieveLaunchParams } from '@telegram-apps/sdk';
import { Toaster } from 'react-hot-toast';

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
      // Initialize Telegram Mini App SDK v3
      init();
      
      let initData: any = null;
      try {
        const params = retrieveLaunchParams();
        initData = params.initData;
      } catch (e) {
        console.log("Not in Telegram environment");
      }

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

      setIsReady(true);

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
