import { useState } from 'react';
import { ArrowLeft, KeyRound, Users, Link2, LogIn, Eye, RefreshCw, Copy, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminRequest, DEMO_MODE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface AdminSummary { users: number; links: number; logins: number }
interface AdminUser {
  id: string; email: string; full_name: string; phone: string;
  login_count: number; last_login_at: string | null; created_at: string;
}
interface UserDetails {
  user: AdminUser;
  links: Array<{ id: string; title: string; url: string; created_at: string }>;
  categories: Array<{ id: string; name: string; created_at: string }>;
}

const KEY_STORAGE = 'link-hub-admin-key';
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString('uz-UZ') : 'Hali login qilmagan';

const Admin = () => {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem(KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState(sessionStorage.getItem(KEY_STORAGE) || '');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<UserDetails | null>(null);
  const [resetUrl, setResetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAdminData = async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const [stats, userRows] = await Promise.all([
        adminRequest<AdminSummary>('/admin/summary', key),
        adminRequest<AdminUser[]>('/admin/users', key),
      ]);
      sessionStorage.setItem(KEY_STORAGE, key);
      setAdminKey(key);
      setSummary(stats);
      setUsers(userRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin ma\'lumotlarini yuklab bo\'lmadi.');
    } finally {
      setLoading(false);
    }
  };

  const openUser = async (user: AdminUser) => {
    setLoading(true);
    setResetUrl('');
    try {
      const details = await adminRequest<UserDetails>(`/admin/user?user_id=${encodeURIComponent(user.id)}`, adminKey);
      setSelected(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foydalanuvchini ochib bo\'lmadi.');
    } finally {
      setLoading(false);
    }
  };

  const createResetLink = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const response = await adminRequest<{ reset_url: string; expires_in_minutes: number }>('/admin/reset-link', adminKey, {
        method: 'POST', body: JSON.stringify({ user_id: selected.user.id }),
      });
      setResetUrl(response.reset_url);
      toast.success(`Parolni tiklash havolasi ${response.expires_in_minutes} daqiqaga yaratildi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tiklash havolasini yaratib bo\'lmadi.');
    } finally {
      setLoading(false);
    }
  };

  const signOutAdmin = () => {
    sessionStorage.removeItem(KEY_STORAGE);
    setAdminKey(''); setKeyInput(''); setSummary(null); setUsers([]); setSelected(null);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft className="mr-2 h-4 w-4" />Saytga qaytish</Button>
          {summary && <Button variant="outline" onClick={signOutAdmin}><LogOut className="mr-2 h-4 w-4" />Admin chiqish</Button>}
        </div>

        <section className="mb-8">
          <h1 className="text-3xl font-bold">Admin panel</h1>
          <p className="mt-2 text-muted-foreground">Foydalanuvchilar va saqlangan linklar haqida ma'lumot.</p>
        </section>

        {DEMO_MODE && !summary ? (
          <section className="glass max-w-lg rounded-2xl p-6">
            <h2 className="font-semibold">Demo rejimida admin API o‘chiq</h2>
            <p className="mt-2 text-sm text-muted-foreground">Admin panel Neon backend Vercel’ga deploy qilingandan keyin ishlaydi. Hozir demo login va linklar shu brauzerda saqlanadi.</p>
          </section>
        ) : !summary ? (
          <form onSubmit={(event) => { event.preventDefault(); void loadAdminData(keyInput); }} className="glass max-w-md space-y-4 rounded-2xl p-6">
            <div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-primary" /><h2 className="font-semibold">Admin kaliti</h2></div>
            <Input type="password" autoComplete="current-password" placeholder="Server admin kaliti" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} required />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" type="submit" disabled={loading}>{loading ? 'Tekshirilmoqda...' : 'Admin sifatida kirish'}</Button>
          </form>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Users />} label="Ro'yxatdan o'tganlar" value={summary.users} />
              <StatCard icon={<LogIn />} label="Jami muvaffaqiyatli login" value={summary.logins} />
              <StatCard icon={<Link2 />} label="Saqlangan linklar" value={summary.links} />
            </div>

            {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <section className="glass rounded-2xl p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Foydalanuvchilar</h2><Button variant="outline" size="sm" onClick={() => void loadAdminData(adminKey)}><RefreshCw className="mr-2 h-4 w-4" />Yangilash</Button></div>
                <div className="max-h-[65vh] space-y-2 overflow-y-auto">
                  {users.map((user) => (
                    <button key={user.id} onClick={() => void openUser(user)} className={`w-full rounded-xl border p-3 text-left transition-colors hover:border-primary/50 ${selected?.user.id === user.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <span className="block font-medium">{user.full_name || user.email}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{user.email} · {user.login_count} marta kirgan</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Ro'yxatdan o'tgan: {dateLabel(user.created_at)}</span>
                    </button>
                  ))}
                  {!users.length && <p className="py-8 text-center text-sm text-muted-foreground">Hozircha foydalanuvchi yo'q.</p>}
                </div>
              </section>

              <section className="glass min-h-64 rounded-2xl p-5">
                {!selected ? <p className="py-12 text-center text-muted-foreground">Tafsilotlarni ko'rish uchun foydalanuvchini tanlang.</p> : (
                  <>
                    <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.user.full_name || 'Ism kiritilmagan'}</h2><p className="text-sm text-muted-foreground">Hisob tafsilotlari</p></div><Eye className="h-5 w-5 text-primary" /></div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <Info label="Email" value={selected.user.email} />
                      <Info label="Telefon" value={selected.user.phone || 'Kiritilmagan'} />
                      <Info label="Ro'yxatdan o'tgan" value={dateLabel(selected.user.created_at)} />
                      <Info label="Oxirgi kirish" value={dateLabel(selected.user.last_login_at)} />
                      <Info label="Kirishlar soni" value={selected.user.login_count} />
                      <Info label="Linklar / kategoriyalar" value={`${selected.links.length} / ${selected.categories.length}`} />
                    </dl>

                    <div className="mt-6 border-t border-border pt-5">
                      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Saqlangan linklar</h3><Button variant="outline" size="sm" disabled={loading} onClick={() => void createResetLink()}>Parolni tiklash havolasi</Button></div>
                      <p className="mb-4 text-xs text-muted-foreground">Parollar xavfsizlik uchun ko'rsatilmaydi. Havolani faqat foydalanuvchining shaxsini tekshirgandan keyin yuboring; u 30 daqiqada tugaydi.</p>
                      {resetUrl && <div className="mb-4 flex gap-2"><Input readOnly value={resetUrl} /><Button variant="outline" size="icon" onClick={() => { void navigator.clipboard.writeText(resetUrl); toast.success('Havola nusxalandi.'); }} aria-label="Havolani nusxalash"><Copy className="h-4 w-4" /></Button></div>}
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {selected.links.map((link) => <div key={link.id} className="rounded-lg border border-border p-3"><p className="font-medium">{link.title}</p><a className="break-all text-sm text-primary underline" href={link.url} target="_blank" rel="noreferrer">{link.url}</a><p className="mt-1 text-xs text-muted-foreground">{dateLabel(link.created_at)}</p></div>)}
                        {!selected.links.length && <p className="text-sm text-muted-foreground">Foydalanuvchida link yo'q.</p>}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="glass rounded-2xl p-5"><div className="mb-3 flex items-center gap-2 text-primary">{icon}<span className="text-sm text-muted-foreground">{label}</span></div><p className="text-3xl font-bold">{value.toLocaleString('uz-UZ')}</p></div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-secondary/50 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>;
}

export default Admin;
