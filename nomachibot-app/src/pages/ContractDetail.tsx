import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface Participant {
  role: string;
  first_name: string | null;
  last_name: string | null;
  confirmed_at: string | null;
  telegram_username: string | null;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: string | number;
  note: string | null;
  running_balance: string | number;
  logged_at: string;
}

interface Contract {
  uuid: string;
  status: string;
  total_amount: string | number;
  monthly_amount: string | number;
  currency: string;
  n_months: number;
  start_date: string;
  description: string | null;
  myRole: string;
  participants: Participant[];
  payments: Payment[];
}

function fmt(amount: string | number, currency: string) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status: string) {
  if (status === 'active')  return 'bg-green-500/15 text-green-400';
  if (status === 'settled') return 'bg-blue-500/15 text-blue-400';
  return 'bg-yellow-500/15 text-yellow-400';
}

export const ContractDetail = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Payment form state
  const today = new Date().toISOString().slice(0, 10);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today);
  const [payNote, setPayNote] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/api/contracts/${uuid}`, { headers });
      setContract(res.data);
      if (!payAmount && res.data.monthly_amount) {
        setPayAmount(String(res.data.monthly_amount));
      }
    } catch {
      toast.error('Failed to load contract');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => { load(); }, [load]);

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      await axios.post(`/api/contracts/${uuid}/payments`, {
        amount: Number(payAmount),
        paymentDate: payDate,
        note: payNote || undefined,
      }, { headers });
      toast.success('Payment logged!');
      setPayNote('');
      load(); // refresh
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to log payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-tg-link/30 border-t-tg-link rounded-full animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-6 text-center">
        <p className="text-tg-hint">Contract not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-tg-link text-sm">{t('goHome')}</button>
      </div>
    );
  }

  const totalPaid = contract.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(contract.total_amount) - totalPaid);
  const paidPct = Math.min(100, (totalPaid / Number(contract.total_amount)) * 100);
  const isLender = contract.myRole === 'lender';
  const canLogPayment = isLender && contract.status === 'active';

  return (
    <div className="min-h-screen bg-tg-bg pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-tg-secondaryBg">
        <button onClick={() => navigate('/')} className="text-tg-link text-sm">← {t('back')}</button>
        <h1 className="flex-1 text-base font-bold text-tg-text truncate">
          {contract.uuid.slice(0, 8)}…
        </h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBadge(contract.status)}`}>
          {contract.status}
        </span>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">

        {/* Summary */}
        <div className="bg-tg-secondaryBg rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-tg-hint text-xs">{t('totalAmount')}</p>
              <p className="font-bold text-tg-text">{fmt(contract.total_amount, contract.currency)}</p>
            </div>
            <div>
              <p className="text-tg-hint text-xs">{t('monthlyAmount')}</p>
              <p className="font-bold text-tg-text">{fmt(contract.monthly_amount, contract.currency)}</p>
            </div>
            <div>
              <p className="text-tg-hint text-xs">{t('paid', 'Paid')}</p>
              <p className="font-bold text-green-500">{fmt(totalPaid, contract.currency)}</p>
            </div>
            <div>
              <p className="text-tg-hint text-xs">{t('remaining', 'Remaining')}</p>
              <p className="font-bold text-tg-text">{fmt(remaining, contract.currency)}</p>
            </div>
          </div>
          <div className="h-2 bg-tg-bg rounded-full overflow-hidden">
            <div className="h-full bg-tg-link rounded-full" style={{ width: `${paidPct}%` }} />
          </div>
          <p className="text-xs text-tg-hint text-right">
            {contract.payments.length}/{contract.n_months} {t('paymentsComplete', 'payments complete')}
          </p>
          {contract.description && (
            <p className="text-sm text-tg-hint italic border-t border-tg-bg pt-2">"{contract.description}"</p>
          )}
        </div>

        {/* Participants */}
        <div className="bg-tg-secondaryBg rounded-2xl p-4">
          <h2 className="font-semibold text-tg-text mb-2">{t('participants')}</h2>
          <div className="space-y-2">
            {contract.participants.map(p => (
              <div key={p.role} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-tg-hint capitalize text-xs">{p.role} · </span>
                  <span className="text-tg-text">
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}
                  </span>
                  {p.telegram_username && <span className="text-tg-link ml-1 text-xs">@{p.telegram_username}</span>}
                </div>
                {p.confirmed_at
                  ? <span className="text-xs text-green-400">✓</span>
                  : <span className="text-xs text-yellow-400">{t('pending')}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Log Payment (lender only, active contracts) */}
        {canLogPayment && (
          <div className="bg-tg-secondaryBg rounded-2xl p-4">
            <h2 className="font-semibold text-tg-text mb-3">{t('logPayment', 'Log Payment Received')}</h2>
            <form onSubmit={handleLogPayment} className="space-y-3">
              <div>
                <label className="text-xs text-tg-hint block mb-1">{t('amount')} ({contract.currency}) *</label>
                <input
                  type="number" min="1" required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-tg-bg text-tg-text text-sm outline-none border border-transparent focus:border-tg-link"
                />
              </div>
              <div>
                <label className="text-xs text-tg-hint block mb-1">{t('paymentDate', 'Payment Date')} *</label>
                <input
                  type="date" required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-tg-bg text-tg-text text-sm outline-none border border-transparent focus:border-tg-link"
                />
              </div>
              <div>
                <label className="text-xs text-tg-hint block mb-1">{t('note', 'Note (optional)')}</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="e.g. Cash, bank transfer…"
                  className="w-full px-3 py-2 rounded-xl bg-tg-bg text-tg-text text-sm outline-none border border-transparent focus:border-tg-link"
                />
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--tg-theme-button-color, #3390ec)', color: 'var(--tg-theme-button-text-color, #fff)' }}
              >
                {submitting ? t('confirming') : t('logPayment', 'Log Payment')}
              </button>
            </form>
          </div>
        )}

        {/* Payment History */}
        {contract.payments.length > 0 && (
          <div className="bg-tg-secondaryBg rounded-2xl p-4">
            <h2 className="font-semibold text-tg-text mb-3">{t('paymentHistory', 'Payment History')}</h2>
            <div className="space-y-2">
              {contract.payments.map((p, i) => (
                <div key={String(p.id || i)} className="flex justify-between items-center text-sm border-b border-tg-bg pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-tg-text">{fmtDate(p.payment_date)}</p>
                    {p.note && <p className="text-xs text-tg-hint">{p.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-500">+{Number(p.amount).toLocaleString()}</p>
                    <p className="text-xs text-tg-hint">{t('balance')}: {Number(p.running_balance).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View public page */}
        <button
          onClick={() => {
            // Open the public status page in the user's external browser,
            // not inside the Telegram Mini App, so no Telegram auth is needed.
            const publicUrl = `${window.location.origin}/status/${contract.uuid}`;
            const tgWebApp = (window as any).Telegram?.WebApp;
            if (tgWebApp?.openLink) {
              tgWebApp.openLink(publicUrl);
            } else {
              window.open(publicUrl, '_blank');
            }
          }}
          className="w-full py-3 rounded-xl text-sm text-tg-link border border-tg-link/30 bg-transparent"
        >
          {t('viewPublicPage')}
        </button>
      </div>
    </div>
  );
};
