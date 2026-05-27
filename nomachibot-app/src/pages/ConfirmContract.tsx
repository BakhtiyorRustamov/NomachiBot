import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PhotoCapture } from '../components/PhotoCapture';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  role: string;
  first_name: string;
  last_name: string;
  patronymic: string | null;
  telegram_username: string | null;
  confirmed_at: string | null;
}

interface ScheduleRow {
  month: number;
  dueDate: string;
  amount: number;
  balance: number;
}

interface ContractPreview {
  uuid: string;
  status: string;
  total_amount: string;
  monthly_amount: string;
  currency: string;
  n_months: number;
  start_date: string;
  description: string | null;
  language: string;
  participants: Participant[];
  schedule: ScheduleRow[];
  participantData: {
    first_name: string;
    last_name: string;
    patronymic: string | null;
    telegram_username: string | null;
    phone: string | null;
    address: string | null;
    already_confirmed: boolean;
  };
}

// ─── Role display helpers ─────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, Record<string, string>> = {
  en: { lender: 'Lender', witness1: 'Witness 1', witness2: 'Witness 2', witness3: 'Witness 3' },
  uz: { lender: 'Qarz beruvchi', witness1: 'Guvoh 1', witness2: 'Guvoh 2', witness3: 'Guvoh 3' },
  ru: { lender: 'Кредитор', witness1: 'Свидетель 1', witness2: 'Свидетель 2', witness3: 'Свидетель 3' },
};

function getRoleLabel(role: string, lang: string): string {
  return ROLE_LABEL[lang]?.[role] ?? ROLE_LABEL['en'][role] ?? role;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ConfirmContract: React.FC = () => {
  const { uuid, role, token } = useParams<{ uuid: string; role: string; token: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Data
  const [contract, setContract] = useState<ContractPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable identity fields (pre-filled from participantData)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patronymic, setPatronymic] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

  // ── Fetch contract preview ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uuid || !role || !token) {
      setError('Invalid invite link.');
      setLoading(false);
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE ?? '';

    axios
      .get(`${apiBase}/api/contracts/${uuid}/preview`, { params: { token, role } })
      .then(res => {
        const data: ContractPreview = res.data;
        setContract(data);

        // Pre-fill from existing participant data (borrower pre-entered some fields)
        setFirstName(data.participantData.first_name ?? '');
        setLastName(data.participantData.last_name ?? '');
        setPatronymic(data.participantData.patronymic ?? '');
        setPhone(data.participantData.phone ?? '');
        setAddress(data.participantData.address ?? '');

        if (data.participantData.already_confirmed) {
          setConfirmed(true);
          setPublicUrl(`${window.location.origin}/status/${uuid}`);
        }
      })
      .catch(err => {
        const msg = err?.response?.data?.error ?? 'Failed to load contract.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [uuid, role, token]);

  // ── Submit confirmation ─────────────────────────────────────────────────────
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error(t('confirmMandatoryFields', 'First name and last name are required.'));
      return;
    }

    setSubmitting(true);
    const jwtToken = localStorage.getItem('token');
    const headers: Record<string, string> = { Authorization: `Bearer ${jwtToken}` };
    const apiBase = import.meta.env.VITE_API_BASE ?? '';

    try {
      let endpoint = '';
      if (role === 'lender') {
        endpoint = `${apiBase}/api/contracts/${uuid}/lender-confirm`;
      } else if (role?.startsWith('witness')) {
        const n = role.replace('witness', '');
        endpoint = `${apiBase}/api/contracts/${uuid}/witness-confirm/${n}`;
      } else {
        toast.error('Unknown role in invite link.');
        setSubmitting(false);
        return;
      }

      // Use FormData so we can optionally attach a photo
      const formData = new FormData();
      formData.append('token', token!);
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      if (patronymic) formData.append('patronymic', patronymic);
      if (phone) formData.append('phone', phone);
      if (address) formData.append('address', address);
      if (photo) formData.append('photo', photo);

      const res = await axios.post(endpoint, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });

      setPublicUrl(res.data.publicUrl || `${window.location.origin}/status/${uuid}`);
      setConfirmed(true);
      toast.success(t('confirmSuccess', 'Confirmed successfully!'));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? t('confirmError', 'Confirmation failed. Please try again.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-tg-link/30 border-t-tg-link rounded-full animate-spin mb-4" />
        <p className="text-tg-hint text-sm">{t('loading', 'Loading...')}</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center max-w-sm">
          <div className="text-4xl mb-3">🔗</div>
          <h2 className="text-lg font-bold text-tg-text mb-2">{t('invalidLink', 'Invalid Invite Link')}</h2>
          <p className="text-red-400 text-sm">{error}</p>
          <Button className="mt-6" onClick={() => navigate('/')}>
            {t('goHome', 'Go to Dashboard')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Already confirmed ───────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Card className="text-center py-10">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-tg-text mb-2">
              {t('confirmSuccess', 'Confirmed!')}
            </h2>
            <p className="text-tg-hint text-sm mb-6">
              {t('confirmSuccessHint', 'Your participation has been recorded on the contract.')}
            </p>
            <div className="bg-tg-secondaryBg rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-tg-hint mb-1">{t('contractId', 'Contract ID')}</p>
              <p className="font-mono text-xs text-tg-text break-all">{uuid}</p>
            </div>

            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl font-semibold text-center mb-3"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
                  color: 'var(--tg-theme-button-text-color, #ffffff)',
                }}
              >
                {t('viewPublicPage', 'View Public Status Page')}
              </a>
            )}

            <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
              {t('goHome', 'Go to Dashboard')}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // ── Confirmation form ───────────────────────────────────────────────────────
  if (!contract) return null;

  const roleLabel = getRoleLabel(role!, i18n.language);
  const borrower = contract.participants.find(p => p.role === 'borrower');
  const lang = contract.language as keyof typeof ROLE_LABEL;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-tg-link text-sm font-medium"
        >
          ← {t('back', 'Back')}
        </button>
        <h1 className="text-xl font-bold text-tg-text flex-1 text-center pr-8">
          {t('confirmAs', 'Confirm as')} {roleLabel}
        </h1>
      </div>

      {/* Role badge */}
      <div
        className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-6"
        style={{
          backgroundColor: 'var(--tg-theme-button-color, #3390ec)20',
          color: 'var(--tg-theme-button-color, #3390ec)',
        }}
      >
        {roleLabel}
      </div>

      {/* Contract summary */}
      <Card className="mb-4">
        <h2 className="text-base font-semibold text-tg-link mb-3">
          {t('contractSummary', 'Contract Summary')}
        </h2>

        {borrower && (
          <div className="flex justify-between items-center py-2 border-b border-tg-secondaryBg">
            <span className="text-sm text-tg-hint">{t('borrower', 'Borrower')}</span>
            <span className="text-sm font-medium text-tg-text">
              {borrower.first_name} {borrower.last_name}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center py-2 border-b border-tg-secondaryBg">
          <span className="text-sm text-tg-hint">{t('totalAmount', 'Total Amount')}</span>
          <span className="text-sm font-bold text-tg-text">
            {Number(contract.total_amount).toLocaleString()} {contract.currency}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-tg-secondaryBg">
          <span className="text-sm text-tg-hint">{t('monthlyAmount', 'Monthly Repayment')}</span>
          <span className="text-sm font-medium text-tg-text">
            {Number(contract.monthly_amount).toLocaleString()} {contract.currency}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-tg-secondaryBg">
          <span className="text-sm text-tg-hint">{t('duration', 'Duration')}</span>
          <span className="text-sm font-medium text-tg-text">
            {t('monthsToRepay', { count: contract.n_months })}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-tg-hint">{t('startDate', 'Start Date')}</span>
          <span className="text-sm font-medium text-tg-text">
            {new Date(contract.start_date).toLocaleDateString()}
          </span>
        </div>

        {contract.description && (
          <div className="mt-3 pt-3 border-t border-tg-secondaryBg">
            <p className="text-xs text-tg-hint mb-1">{t('description', 'Purpose')}</p>
            <p className="text-sm text-tg-text">{contract.description}</p>
          </div>
        )}
      </Card>

      {/* Repayment schedule */}
      {contract.schedule.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-base font-semibold text-tg-link mb-3">
            {t('repaymentSchedule', 'Repayment Schedule')}
          </h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs text-left min-w-[260px]">
              <thead>
                <tr className="border-b border-tg-secondaryBg text-tg-hint">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">{t('dueDate', 'Due Date')}</th>
                  <th className="py-2 px-2 text-right">{t('amount', 'Amount')}</th>
                  <th className="py-2 px-2 text-right">{t('balance', 'Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {contract.schedule.slice(0, 6).map(row => (
                  <tr key={row.month} className="border-b border-tg-secondaryBg/50">
                    <td className="py-1.5 px-2 text-tg-hint">{row.month}</td>
                    <td className="py-1.5 px-2 text-tg-text">
                      {new Date(row.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 px-2 text-right text-tg-text">
                      {row.amount.toLocaleString()} {contract.currency}
                    </td>
                    <td className="py-1.5 px-2 text-right text-tg-hint">
                      {Math.max(0, row.balance).toLocaleString()} {contract.currency}
                    </td>
                  </tr>
                ))}
                {contract.schedule.length > 6 && (
                  <tr>
                    <td colSpan={4} className="py-2 px-2 text-center text-tg-hint text-xs italic">
                      … {contract.schedule.length - 6} {t('moreMonths', 'more months')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Other participants */}
      <Card className="mb-4">
        <h2 className="text-base font-semibold text-tg-link mb-3">
          {t('participants', 'Participants')}
        </h2>
        {contract.participants.map(p => (
          <div key={p.role} className="flex justify-between items-center py-2 border-b last:border-0 border-tg-secondaryBg">
            <div>
              <span className="text-xs font-semibold text-tg-link capitalize">
                {getRoleLabel(p.role, lang)}
              </span>
              <p className="text-sm text-tg-text">
                {p.first_name} {p.last_name}
              </p>
              {p.telegram_username && (
                <p className="text-xs text-tg-hint">@{p.telegram_username.replace('@', '')}</p>
              )}
            </div>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                p.confirmed_at
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-yellow-500/15 text-yellow-400'
              }`}
            >
              {p.confirmed_at ? t('confirmed', 'Confirmed') : t('pending', 'Pending')}
            </span>
          </div>
        ))}
      </Card>

      {/* Identity form */}
      <form onSubmit={handleConfirm}>
        <Card className="mb-4">
          <h2 className="text-base font-semibold text-tg-link mb-3">
            {t('yourDetails', 'Your Details')}
          </h2>
          <p className="text-xs text-tg-hint mb-4">
            {t('confirmDetailsHint', 'Review and update your information below before confirming.')}
          </p>

          <Input
            label={`${t('firstName', 'First Name')} *`}
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
          />
          <Input
            label={`${t('lastName', 'Last Name')} *`}
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
          />
          <Input
            label={t('patronymic', 'Patronymic')}
            value={patronymic}
            onChange={e => setPatronymic(e.target.value)}
          />
          <Input
            label={t('phone', 'Phone Number')}
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998"
          />
          <Input
            label={t('address', 'Address')}
            value={address}
            onChange={e => setAddress(e.target.value)}
          />

          <PhotoCapture
            onPhotoCapture={setPhoto}
            onPhotoRemove={() => setPhoto(null)}
          />
        </Card>

        {/* Disclaimer */}
        <div className="text-xs text-tg-hint text-center px-2 mb-6 leading-relaxed">
          {t(
            'legalDisclaimer',
            'This document is a formal record of mutual intent. It does not constitute a notarized legal instrument. Consult a qualified lawyer for legal enforcement.',
          )}
        </div>

        <Button
          type="submit"
          fullWidth
          className="text-lg font-bold py-4"
          disabled={submitting}
        >
          {submitting
            ? t('confirming', 'Confirming…')
            : role === 'lender'
            ? t('confirmAndSign', 'Confirm & Sign')
            : t('confirmAsWitness', 'I Confirm as Witness')}
        </Button>
      </form>
    </div>
  );
};
