import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PhotoCapture } from '../components/PhotoCapture';
import toast from 'react-hot-toast';

interface InviteToken {
  role: string;
  link: string;
}

interface Witness {
  firstName: string;
  lastName: string;
  username: string;
}

export const CreateContract: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  // Borrower details (mocked from Telegram initData in a real scenario)
  const [borrower, setBorrower] = useState({
    firstName: 'John',
    lastName: 'Doe',
    patronymic: '',
    phone: '',
    address: '',
    username: 'johndoe'
  });
  const [, setBorrowerPhoto] = useState<File | null>(null);

  // Lender details
  const [lender, setLender] = useState({
    firstName: '',
    lastName: '',
    patronymic: '',
    phone: '',
    address: '',
    username: ''
  });

  // Witnesses
  const [witnesses, setWitnesses] = useState<Witness[]>([]);

  // Debt Terms
  const [currency, setCurrency] = useState('UZS');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [monthlyAmount, setMonthlyAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  // UI State
  const [createdTokens, setCreatedTokens] = useState<InviteToken[]>([]);
  const [createdUuid, setCreatedUuid] = useState<string | null>(null);

  // Real-time calculator
  const months = useMemo(() => {
    if (typeof totalAmount === 'number' && typeof monthlyAmount === 'number' && monthlyAmount > 0) {
      return Math.ceil(totalAmount / monthlyAmount);
    }
    return null;
  }, [totalAmount, monthlyAmount]);

  const lastPayment = useMemo(() => {
    if (typeof totalAmount === 'number' && typeof monthlyAmount === 'number' && monthlyAmount > 0) {
      const rem = totalAmount % monthlyAmount;
      return rem === 0 ? monthlyAmount : rem;
    }
    return null;
  }, [totalAmount, monthlyAmount]);

  const schedulePreview = useMemo(() => {
    if (!months || !totalAmount || !monthlyAmount || months <= 0) return [];
    const schedule = [];
    let remaining = totalAmount;
    for (let i = 1; i <= months; i++) {
      const amount = i === months && lastPayment ? lastPayment : monthlyAmount;
      remaining -= amount;
      schedule.push({ month: i, amount, balance: remaining });
    }
    return schedule;
  }, [months, totalAmount, monthlyAmount, lastPayment]);

  const addWitness = () => {
    if (witnesses.length < 3) {
      setWitnesses([...witnesses, { firstName: '', lastName: '', username: '' }]);
    }
  };

  const removeWitness = (index: number) => {
    setWitnesses(witnesses.filter((_, i) => i !== index));
  };

  const updateWitness = (index: number, field: keyof Witness, value: string) => {
    const newWitnesses = [...witnesses];
    newWitnesses[index][field] = value;
    setWitnesses(newWitnesses);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lender.firstName || !lender.lastName || !lender.username) {
      toast.error('Lender mandatory fields missing');
      return;
    }
    if (!totalAmount || !monthlyAmount || totalAmount <= 0 || monthlyAmount <= 0) {
      toast.error('Invalid debt amounts');
      return;
    }

    toast.loading('Creating contract...');
    try {
      // Mocking the API response for local dev since backend DB isn't running
      const mockTokens = [
        { role: 'lender', link: `https://t.me/nomachibot/app?startapp=mockuuid_lender_token123` },
        ...witnesses.map((_, i) => ({ role: `witness${i + 1}`, link: `https://t.me/nomachibot/app?startapp=mockuuid_witness${i+1}_token456` }))
      ];
      
      setTimeout(() => {
        toast.dismiss();
        toast.success(t('contractCreated'));
        setCreatedUuid('mock-uuid-1234');
        setCreatedTokens(mockTokens);
      }, 1000);

      /* Real API Code:
      const res = await axios.post('/api/contracts', {
        totalAmount, monthlyAmount, currency, description, language: i18n.language,
        borrower, lender, witnesses
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      
      if (borrowerPhoto) {
        const formData = new FormData();
        formData.append('photo', borrowerPhoto);
        formData.append('role', 'borrower');
        await axios.post(`/api/contracts/${res.data.uuid}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      toast.dismiss();
      toast.success(t('contractCreated'));
      setCreatedUuid(res.data.uuid);
      setCreatedTokens(res.data.inviteTokens);
      */
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to create contract');
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  if (createdUuid) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <Card className="text-center py-10">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-tg-text mb-2">{t('contractCreated')}</h2>
          <p className="text-tg-hint mb-8">Share these unique invite links with the participants.</p>
          
          <div className="space-y-4 text-left">
            {createdTokens.map((token) => (
              <div key={token.role} className="bg-tg-secondaryBg p-3 rounded-lg border border-tg-link/20">
                <p className="text-sm font-semibold text-tg-link capitalize mb-1">{token.role} Invite Link</p>
                <div className="flex gap-2">
                  <input type="text" readOnly value={token.link} className="flex-1 bg-transparent text-xs text-tg-text outline-none truncate" />
                  <button onClick={() => copyLink(token.link)} className="text-tg-link text-xs font-bold uppercase bg-tg-bg px-2 py-1 rounded">Copy</button>
                </div>
              </div>
            ))}
          </div>
          
          <Button fullWidth className="mt-8" onClick={() => window.location.href = '/'}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-tg-text">{t('createContract')}</h1>
        <select 
          className="bg-tg-secondaryBg text-tg-text px-2 py-1 rounded"
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Borrower Details */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-tg-link">{t('myDetails')}</h2>
          <Input label={`${t('firstName')} *`} value={borrower.firstName} onChange={e => setBorrower({ ...borrower, firstName: e.target.value })} required />
          <Input label={`${t('lastName')} *`} value={borrower.lastName} onChange={e => setBorrower({ ...borrower, lastName: e.target.value })} required />
          <Input label={t('patronymic')} value={borrower.patronymic} onChange={e => setBorrower({ ...borrower, patronymic: e.target.value })} />
          <Input label={t('phone')} type="tel" value={borrower.phone} onChange={e => setBorrower({ ...borrower, phone: e.target.value })} placeholder="+998" />
          <Input label={t('address')} value={borrower.address} onChange={e => setBorrower({ ...borrower, address: e.target.value })} />
          <PhotoCapture onPhotoCapture={setBorrowerPhoto} onPhotoRemove={() => setBorrowerPhoto(null)} />
        </Card>

        {/* Lender Details */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-tg-link">{t('lenderDetails')}</h2>
          <Input label={`${t('username')} *`} placeholder="@username" value={lender.username} onChange={e => setLender({ ...lender, username: e.target.value })} required />
          <Input label={`${t('firstName')} *`} value={lender.firstName} onChange={e => setLender({ ...lender, firstName: e.target.value })} required />
          <Input label={`${t('lastName')} *`} value={lender.lastName} onChange={e => setLender({ ...lender, lastName: e.target.value })} required />
          <Input label={t('patronymic')} value={lender.patronymic} onChange={e => setLender({ ...lender, patronymic: e.target.value })} />
          <Input label={t('phone')} type="tel" value={lender.phone} onChange={e => setLender({ ...lender, phone: e.target.value })} />
          <Input label={t('address')} value={lender.address} onChange={e => setLender({ ...lender, address: e.target.value })} />
        </Card>

        {/* Witnesses */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-tg-link">{t('witnesses')}</h2>
            {witnesses.length < 3 && (
              <Button type="button" variant="secondary" onClick={addWitness} className="!py-1 !px-3 text-sm">
                + {t('addWitness')}
              </Button>
            )}
          </div>
          {witnesses.map((w, index) => (
            <div key={index} className="p-3 mb-3 border border-tg-secondaryBg rounded-lg bg-tg-bg/50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">Witness {index + 1}</span>
                <button type="button" onClick={() => removeWitness(index)} className="text-red-500 text-xs font-medium">{t('remove')}</button>
              </div>
              <Input label={`${t('username')} *`} value={w.username} onChange={e => updateWitness(index, 'username', e.target.value)} required />
              <Input label={`${t('firstName')} *`} value={w.firstName} onChange={e => updateWitness(index, 'firstName', e.target.value)} required />
              <Input label={`${t('lastName')} *`} value={w.lastName} onChange={e => updateWitness(index, 'lastName', e.target.value)} required />
            </div>
          ))}
          {witnesses.length === 0 && <p className="text-sm text-tg-hint italic">No witnesses added.</p>}
        </Card>

        {/* Debt Terms */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-tg-link">{t('debtTerms')}</h2>
          <div className="flex flex-col mb-4">
            <label className="mb-1 text-sm font-medium text-tg-hint">{t('currency')}</label>
            <select 
              className="px-4 py-3 rounded-lg bg-tg-secondaryBg text-tg-text border border-transparent focus:border-tg-link outline-none transition-colors"
              value={currency} 
              onChange={e => setCurrency(e.target.value)}
            >
              <option value="UZS">UZS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <Input 
            label={`${t('totalAmount')} *`} 
            type="number" 
            min="1"
            value={totalAmount} 
            onChange={e => setTotalAmount(e.target.value ? Number(e.target.value) : '')} 
            required 
          />
          <Input 
            label={`${t('monthlyAmount')} *`} 
            type="number" 
            min="1"
            value={monthlyAmount} 
            onChange={e => setMonthlyAmount(e.target.value ? Number(e.target.value) : '')} 
            required 
          />
          
          {/* Real-time Calculator Output */}
          <div className="mt-4 p-4 rounded-xl bg-tg-link/10 border border-tg-link/20 text-center">
            {months !== null ? (
              <>
                <p className="text-xl font-bold text-tg-link mb-1">
                  {t('monthsToRepay', { count: months })}
                </p>
                <p className="text-sm text-tg-hint">
                  {t('lastPayment', { amount: `${lastPayment} ${currency}` })}
                </p>
              </>
            ) : (
              <p className="text-lg text-tg-hint">—</p>
            )}
          </div>

          <div className="mt-4">
            <label className="mb-1 text-sm font-medium text-tg-hint block">{t('description')}</label>
            <textarea 
              className="w-full px-4 py-3 rounded-lg bg-tg-secondaryBg text-tg-text border border-transparent focus:border-tg-link outline-none transition-colors"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Repayment Preview Table */}
          {schedulePreview.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-tg-hint mb-2">Expected Repayment Schedule</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-tg-secondaryBg text-tg-hint">
                      <th className="py-2">Month</th>
                      <th className="py-2 text-right">Amount</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedulePreview.map(row => (
                      <tr key={row.month} className="border-b border-tg-secondaryBg/50">
                        <td className="py-2">{row.month}</td>
                        <td className="py-2 text-right">{row.amount} {currency}</td>
                        <td className="py-2 text-right">{Math.max(0, row.balance)} {currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        <Button type="submit" fullWidth className="mt-8 text-lg font-bold">
          {t('submit')}
        </Button>
      </form>
    </div>
  );
};
