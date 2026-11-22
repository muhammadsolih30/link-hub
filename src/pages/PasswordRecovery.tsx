import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, HelpCircle, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PasswordRecovery = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeReady, setCodeReady] = useState(false);

  useEffect(() => {
    if (code || codeVerified || !email || !phone) return;
    let active = true;
    const checkForCode = async () => {
      try {
        const result = await apiRequest<{ status: 'waiting' | 'ready'; code?: string }>('/auth/recovery-status', {
          method: 'POST', body: JSON.stringify({ email, phone }),
        });
        if (active && result.status === 'ready' && result.code) {
          setCode(result.code);
          setCodeReady(true);
          toast.success('Admin tasdiqlagan kod shu yerga keldi.');
        }
      } catch {
        // Keep checking; the request remains visible in the admin panel.
      }
    };
    void checkForCode();
    const timer = window.setInterval(() => { void checkForCode(); }, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [code, codeVerified, email, phone]);

  const sendHelpRequest = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await apiRequest('/auth/recovery-request', { method: 'POST', body: JSON.stringify({ email, full_name: fullName, phone }) });
      setRequestSent(true);
      toast.success('Yordam so‘rovi yuborildi.');
    } catch (err) { setError(err instanceof Error ? err.message : 'So‘rovni yuborib bo‘lmadi.'); }
    finally { setLoading(false); }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await apiRequest('/auth/verify-recovery-code', { method: 'POST', body: JSON.stringify({ email, code }) });
      setCodeVerified(true);
      toast.success('Kod tasdiqlandi. Endi yangi parol o‘rnating.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Kodni tekshirib bo‘lmadi.'); }
    finally { setLoading(false); }
  };

  const setPassword = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (newPassword.length < 8 || newPassword.length > 72) return setError('Yangi parol 8–72 ta belgidan iborat bo‘lsin.');
    if (newPassword !== confirmPassword) return setError('Yangi parollar bir xil emas.');
    setLoading(true);
    try {
      await apiRequest('/auth/recover-with-code', { method: 'POST', body: JSON.stringify({ email, code, new_password: newPassword }) });
      toast.success('Parol yangilandi. Endi yangi parol bilan kiring.');
      navigate('/auth');
    } catch (err) { setError(err instanceof Error ? err.message : 'Parolni yangilab bo‘lmadi.'); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <section className="glass mx-auto w-full max-w-lg rounded-2xl p-6 sm:p-8">
        <Link to="/auth" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Kirish sahifasiga qaytish</Link>
        <div className="mb-6 text-center"><KeyRound className="mx-auto mb-3 h-8 w-8 text-primary" /><h1 className="text-2xl font-bold">Parolni tiklash</h1><p className="mt-2 text-sm text-muted-foreground">Ma’lumotlaringizni yuboring. Admin tekshirganidan keyin 30 daqiqalik kod bilan yangi parol o‘rnatasiz.</p></div>
        {error && <p className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}

        <form onSubmit={sendHelpRequest} className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary" /><h2 className="font-semibold">Yordam so‘rash</h2></div>
          <p className="text-xs text-muted-foreground">Akkauntda ro‘yxatdan o‘tgan email, ism-familiya va telefon raqamini kiriting.</p>
          <Input type="email" autoComplete="email" placeholder="Akkaunt emaili" value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); setCodeReady(false); setCodeVerified(false); }} required />
          <Input autoComplete="name" placeholder="Ro‘yxatdan o‘tgan ism-familiya" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          <Input type="tel" autoComplete="tel" placeholder="Ro‘yxatdan o‘tgan telefon" value={phone} onChange={(event) => { setPhone(event.target.value); setCode(''); setCodeReady(false); setCodeVerified(false); }} required />
          <Button type="submit" variant="outline" className="w-full" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Yuborilmoqda...</> : requestSent ? 'So‘rovni qayta yuborish' : 'Yordam so‘rovini yuborish'}</Button>
          {requestSent && <p className="text-sm text-primary">So‘rov yuborildi. Admin tasdiqlagan kod shu sahifaga avtomatik keladi.</p>}
        </form>

        <form onSubmit={codeVerified ? setPassword : verifyCode} className="mt-5 space-y-3 rounded-xl border border-border p-4">
          <h2 className="font-semibold">{codeVerified ? 'Yangi parol o‘rnatish' : 'Admin bergan kodni tasdiqlash'}</h2>
          <Input type="email" autoComplete="email" placeholder="Akkaunt emaili" value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); setCodeReady(false); setCodeVerified(false); }} required />
          <Input autoComplete="one-time-code" placeholder={codeReady ? 'Admin kodi keldi' : 'Admin kodi kutilmoqda'} value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setCodeVerified(false); setCodeReady(false); }} required minLength={12} maxLength={12} />
          {codeVerified && <>
            <Input type="password" autoComplete="new-password" placeholder="Yangi parol" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} maxLength={72} />
            <Input type="password" autoComplete="new-password" placeholder="Yangi parolni takrorlang" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={72} />
          </>}
          <p className="text-xs text-muted-foreground">Kod bir marta ishlaydi va 30 daqiqada tugaydi.{requestSent && !codeReady ? ' Admin tasdiqlashini kuting.' : ''}</p>
          <Button className="w-full" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{codeVerified ? 'Saqlanmoqda...' : 'Tekshirilmoqda...'}</> : codeVerified ? 'Parolni saqlash' : 'Kodni tekshirish'}</Button>
        </form>
      </section>
    </main>
  );
};

export default PasswordRecovery;

