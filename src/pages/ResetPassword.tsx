import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Link2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (token) window.history.replaceState({}, '', '/reset-password'); }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) return setError('Tiklash havolasi noto\'g\'ri yoki topilmadi.');
    if (password.length < 8 || password.length > 72) return setError('Parol 8–72 ta belgidan iborat bo\'lsin.');
    if (password !== confirmPassword) return setError('Parollar bir xil emas.');
    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      toast.success('Parol yangilandi. Endi yangi parol bilan kiring.');
      navigate('/auth');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parolni yangilab bo\'lmadi.');
    } finally { setLoading(false); }
  };

  return <main className="min-h-screen flex items-center justify-center bg-background p-4"><form onSubmit={submit} className="glass w-full max-w-md space-y-5 rounded-2xl p-7">
    <div className="text-center"><Link2 className="mx-auto mb-3 h-8 w-8 text-primary" /><h1 className="text-2xl font-bold">Yangi parol o'rnating</h1><p className="mt-2 text-sm text-muted-foreground">Yangi parolingiz kamida 8 ta belgidan iborat bo'lsin.</p></div>
    {error && <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
    <div className="relative"><Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input type="password" autoComplete="new-password" placeholder="Yangi parol" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-11" required minLength={8} maxLength={72} /></div>
    <div className="relative"><Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input type="password" autoComplete="new-password" placeholder="Yangi parolni takrorlang" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="pl-11" required minLength={8} maxLength={72} /></div>
    <Button className="w-full" type="submit" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</> : 'Parolni yangilash'}</Button>
  </form></main>;
};

export default ResetPassword;
