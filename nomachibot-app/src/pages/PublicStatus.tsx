import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

interface Participant {
  role: string;
  first_name: string | null;
  last_name: string | null;
  patronymic: string | null;
  telegram_username: string | null;
  phone: string | null;
  address: string | null;
  confirmed_at: string | null;
  photo_url: string | null;
}

interface Payment {
  index: number;
  payment_date: string;
  amount: string | number;
  note: string | null;
  running_balance: string | number;
  logged_at: string;
}

interface ContractData {
  uuid: string;
  status: string;
  total_amount: string | number;
  monthly_amount: string | number;
  currency: string;
  n_months: number;
  start_date: string;
  description: string | null;
  language: string;
  created_at: string;
  activated_at: string | null;
  participants: Participant[];
  payments: Payment[];
  summary: {
    total_amount: string | number;
    total_paid: number;
    remaining: number;
    months_total: number;
    payments_count: number;
  };
}

interface ScheduleRow {
  month: number;
  due_date: string;
  amount: number;
  balance: number;
}

function fmt(amount: string | number, currency: string) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildSchedule(data: ContractData): ScheduleRow[] {
  const monthly = Number(data.monthly_amount);
  const total = Number(data.total_amount);
  const n = data.n_months;
  const start = new Date(data.start_date);
  const rows: ScheduleRow[] = [];
  let balance = total;
  for (let i = 1; i <= n; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    const amt = i === n ? balance : Math.min(monthly, balance);
    balance = Math.max(0, balance - amt);
    rows.push({ month: i, due_date: due.toISOString().slice(0, 10), amount: amt, balance });
  }
  return rows;
}



function statusBadge(status: string) {
  if (status === 'active') return { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Active' };
  if (status === 'settled') return { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Settled' };
  return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Pending' };
}

export const PublicStatus = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const getRoleName = (role: string) => {
    if (role === 'borrower') return t('borrower', 'Borrower');
    if (role === 'lender') return t('lender', 'Lender');
    return `${t('witness', 'Witness')} ${role.replace('witness', '')}`;
  };
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    axios.get(`/public/status/${uuid}`)
      .then(res => {
        setData(res.data);
        const lang = localStorage.getItem('appLang') || res.data.language || 'en';
        i18n.changeLanguage(lang);
      })
      .catch(() => setError('Contract not found or unavailable.'))
      .finally(() => setLoading(false));
  }, [uuid, i18n]);

  const handleDownloadPdf = async () => {
    if (!uuid) return;
    setPdfLoading(true);
    try {
      const res = await axios.get(`/public/status/${uuid}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `nomachi_${uuid.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
        <p className="text-gray-400 text-sm">{t('loading', 'Loading...')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center max-w-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400">{error || 'Contract not found.'}</p>
        </div>
      </div>
    );
  }

  const schedule = buildSchedule(data);
  const sc = statusBadge(data.status);
  const paidCount = data.summary.payments_count;
  const paidPct = Math.min(100, (data.summary.total_paid / Number(data.total_amount)) * 100);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-16">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-white">NomachiBot</span>
          <span className="ml-2 text-xs text-gray-500 font-mono">{data.uuid.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {sc.label}
          </span>
          <select
            className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg outline-none"
            value={i18n.language}
            onChange={e => { i18n.changeLanguage(e.target.value); localStorage.setItem('appLang', e.target.value); }}
          >
            <option value="en">EN</option>
            <option value="uz">UZ</option>
            <option value="ru">RU</option>
          </select>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-4">

        {/* Contract Summary */}
        <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-200">{t('contractSummary', 'Contract Summary')}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">{t('totalAmount', 'Total Amount')}</p>
              <p className="font-bold text-white">{fmt(data.total_amount, data.currency)}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">{t('monthlyAmount', 'Monthly')}</p>
              <p className="font-bold text-white">{fmt(data.monthly_amount, data.currency)}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">{t('duration', 'Duration')}</p>
              <p className="font-bold text-white">{data.n_months} {t('months', 'months')}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">{t('startDate', 'Start Date')}</p>
              <p className="font-bold text-white">{fmtDate(data.start_date)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{t('paid', 'Paid')}: {fmt(data.summary.total_paid, data.currency)}</span>
              <span>{t('remaining', 'Remaining')}: {fmt(data.summary.remaining, data.currency)}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
            </div>
            <p className="text-right text-xs text-gray-500 mt-1">
              {paidCount}/{data.n_months} {t('paymentsComplete', 'payments complete')}
            </p>
          </div>

          {data.description && (
            <p className="text-sm text-gray-400 italic border-t border-gray-800 pt-3">"{data.description}"</p>
          )}
        </section>

        {/* Participants */}
        <section className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-semibold text-gray-200 mb-3">{t('participants', 'Participants')}</h2>
          <div className="space-y-2">
            {data.participants.map(p => (
              <div key={p.role} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 flex items-center justify-center">
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xl">👤</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{getRoleName(p.role)}</p>
                  <p className="font-medium text-white text-sm truncate">
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}
                  </p>
                  {p.telegram_username && <p className="text-xs text-blue-400">@{p.telegram_username}</p>}
                </div>
                <div className="flex-shrink-0">
                  {p.confirmed_at
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">✓ {t('confirmed', 'Confirmed')}</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{t('pending', 'Pending')}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Repayment Schedule */}
        <section className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-semibold text-gray-200 mb-3">{t('repaymentSchedule', 'Repayment Schedule')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">{t('dueDate', 'Due Date')}</th>
                  <th className="text-right pb-2">{t('amount', 'Amount')}</th>
                  <th className="text-right pb-2">{t('balance', 'Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, idx) => (
                  <tr key={row.month} className={`border-b border-gray-800/50 ${idx < paidCount ? 'opacity-40' : ''}`}>
                    <td className="py-2 text-gray-500">{row.month}</td>
                    <td className="py-2 text-gray-300">{fmtDate(row.due_date)}</td>
                    <td className="py-2 text-right text-white">{Number(row.amount).toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-400">{Number(row.balance).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment History */}
        {data.payments.length > 0 && (
          <section className="bg-gray-900 rounded-2xl p-4">
            <h2 className="font-semibold text-gray-200 mb-3">{t('paymentHistory', 'Payment History')}</h2>
            <div className="space-y-2">
              {data.payments.map(p => (
                <div key={p.index} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm text-white">
                      {fmtDate(p.payment_date)}
                      {p.note && <span className="text-gray-500 text-xs ml-2">— {p.note}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{t('logged', 'Logged')}: {fmtDate(p.logged_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-400">+{Number(p.amount).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{t('balance', 'Balance')}: {Number(p.running_balance).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legal disclaimer */}
        <p className="text-xs text-gray-600 text-center px-2">{t('legalDisclaimer')}</p>

        {/* Download PDF */}
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="w-full py-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-60"
        >
          {pdfLoading ? t('generatingPdf', 'Generating PDF…') : t('downloadPdf', 'Download Agreement PDF')}
        </button>

        <p className="text-center text-xs text-gray-700 font-mono pb-4">{data.uuid}</p>
      </div>
    </div>
  );
};
