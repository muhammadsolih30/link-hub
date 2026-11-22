import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, Check, CheckCheck, Copy, Eye, KeyRound, Link2, Loader2, LogIn, LogOut, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { adminRequest, DEMO_MODE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface AdminSummary { users: number; links: number; logins: number }
interface RecoveryRequest {
  id: string; email: string; full_name: string; phone: string; status: string; created_at: string;
  admin_seen_at?: string | null; registered_email?: string; registered_full_name?: string;
  registered_phone?: string; identity_matches?: boolean;
}
interface AdminUser {
  id: string; email: string; full_name: string; phone: string;
  login_count: number; last_login_at: string | null; created_at: string;
}
interface UserLink { id: string; title: string; url: string; created_at: string }
interface UserDetails {
  user: AdminUser;
  links: UserLink[];
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
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [issuedCodes, setIssuedCodes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<UserDetails | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationQuery, setNotificationQuery] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seenIds = useRef(new Set<string>());

  const unreadCount = requests.filter((request) => !request.admin_seen_at).length;
  const visibleUsers = useMemo(() => {
    const query = userQuery.trim().toLocaleLowerCase();
    if (!query) return users;
    return users.filter((user) => (user.full_name + ' ' + user.email + ' ' + user.phone).toLocaleLowerCase().includes(query));
  }, [users, userQuery]);
  const visibleLinks = useMemo(() => {
    const query = linkQuery.trim().toLocaleLowerCase();
    if (!query) return selected?.links || [];
    return (selected?.links || []).filter((link) => (link.title + ' ' + link.url).toLocaleLowerCase().includes(query));
  }, [selected, linkQuery]);
  const visibleRequests = useMemo(() => {
    const query = notificationQuery.trim().toLocaleLowerCase();
    if (!query) return requests;
    return requests.filter((request) => [request.email, request.full_name, request.phone, request.status].join(' ').toLocaleLowerCase().includes(query));
  }, [requests, notificationQuery]);

  useEffect(() => {
    if (!summary || !adminKey) return;
    let active = true;
    const poll = async () => {
      try {
        const rows = await adminRequest<RecoveryRequest[]>('/admin/recovery-requests', adminKey);
        if (!active) return;
        rows.filter((row) => !seenIds.current.has(row.id)).forEach((row) => toast.info('Yangi tiklash so‘rovi: ' + row.email));
        rows.forEach((row) => seenIds.current.add(row.id));
        setRequests(rows);
      } catch { /* Polling retries on the next interval. */ }
    };
    const timer = window.setInterval(() => { void poll(); }, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [adminKey, summary]);

  const loadAdminData = async (key: string) => {
    setLoading(true); setError('');
    try {
      const [stats, userRows, recoveryRows] = await Promise.all([
        adminRequest<AdminSummary>('/admin/summary', key),
        adminRequest<AdminUser[]>('/admin/users', key),
        adminRequest<RecoveryRequest[]>('/admin/recovery-requests', key),
      ]);
      sessionStorage.setItem(KEY_STORAGE, key);
      setAdminKey(key); setSummary(stats); setUsers(userRows); setRequests(recoveryRows);
      recoveryRows.forEach((request) => seenIds.current.add(request.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin ma’lumotlarini yuklab bo‘lmadi.');
    } finally { setLoading(false); }
  };

  const markNotificationsSeen = async (requestId?: string) => {
    if (!adminKey) return;
    try {
      await adminRequest('/admin/recovery-requests/seen', adminKey, { method: 'POST', body: JSON.stringify(requestId ? { request_id: requestId } : {}) });
      const seenAt = new Date().toISOString();
      setRequests((rows) => rows.map((row) => (requestId ? row.id === requestId : true) && !row.admin_seen_at ? { ...row, admin_seen_at: seenAt } : row));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bildirishnomani o‘qildi deb belgilab bo‘lmadi.');
    }
  };

  const issueRecoveryCode = async (request: RecoveryRequest) => {
    setLoading(true); setError('');
    try {
      const result = await adminRequest<{ code: string; expires_in_minutes: number }>('/admin/recovery-code', adminKey, {
        method: 'POST', body: JSON.stringify({ request_id: request.id }),
      });
      setIssuedCodes((codes) => ({ ...codes, [request.id]: result.code }));
      setRequests((rows) => rows.map((row) => row.id === request.id ? { ...row, status: 'code_issued' } : row));
      toast.success('Kod foydalanuvchining tiklash sahifasiga yuborildi. ' + result.expires_in_minutes + ' daqiqa amal qiladi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Maxsus kod yaratilmadi.');
    } finally { setLoading(false); }
  };

  const openUser = async (user: AdminUser) => {
    setLoading(true); setError(''); setResetUrl(''); setLinkQuery('');
    try {
      setSelected(await adminRequest<UserDetails>('/admin/user?user_id=' + encodeURIComponent(user.id), adminKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foydalanuvchi ma’lumotlarini ochib bo‘lmadi.');
    } finally { setLoading(false); }
  };

  const createResetLink = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const response = await adminRequest<{ reset_url: string; expires_in_minutes: number }>('/admin/reset-link', adminKey, {
        method: 'POST', body: JSON.stringify({ user_id: selected.user.id }),
      });
      setResetUrl(response.reset_url);
      toast.success('Tiklash havolasi ' + response.expires_in_minutes + ' daqiqaga yaratildi.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Tiklash havolasini yaratib bo‘lmadi.'); }
    finally { setLoading(false); }
  };

  const signOutAdmin = () => {
    sessionStorage.removeItem(KEY_STORAGE);
    setAdminKey(''); setKeyInput(''); setSummary(null); setUsers([]); setRequests([]); setSelected(null);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Saytga qaytish"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></div>
            <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">LinkManager</p><h1 className="text-xl font-bold sm:text-2xl">Boshqaruv paneli</h1></div>
          </div>
          {summary && <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setNotificationsOpen(true)} aria-label={'Bildirishnomalar, ' + unreadCount + ' ta o‘qilmagan'}>
              <Bell className="mr-2 h-4 w-4" />Bildirishnomalar
              {unreadCount > 0 && <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Button>
            <Button variant="outline" onClick={signOutAdmin}><LogOut className="mr-2 h-4 w-4" />Chiqish</Button>
          </div>}
        </header>

        {!summary ? (
          <section className="glass mx-auto mt-16 w-full max-w-md rounded-3xl p-7 shadow-xl">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="h-6 w-6" /></div>
            <h2 className="text-2xl font-bold">Admin panelga kirish</h2>
            <p className="mt-2 text-sm text-muted-foreground">Davom etish uchun admin kalitini kiriting.</p>
            <form onSubmit={(event) => { event.preventDefault(); void loadAdminData(keyInput); }} className="mt-6 space-y-4">
              <Input type="password" autoComplete="current-password" placeholder={DEMO_MODE ? 'Admin kodi' : 'Admin kaliti'} value={keyInput} onChange={(event) => setKeyInput(event.target.value)} required />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Tekshirilmoqda...</> : 'Admin sifatida kirish'}</Button>
            </form>
          </section>
        ) : <>
          <div className="mb-7 grid gap-4 sm:grid-cols-3">
            <StatCard icon={<Users />} label="Foydalanuvchilar" value={summary.users} />
            <StatCard icon={<LogIn />} label="Jami kirishlar" value={summary.logins} />
            <StatCard icon={<Link2 />} label="Saqlangan saytlar" value={summary.links} />
          </div>
          {error && <p className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <div className="grid min-h-[68vh] gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.65fr)]">
            <section className="glass flex min-h-[560px] flex-col overflow-hidden rounded-3xl">
              <div className="border-b border-border p-5">
                <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Foydalanuvchilar</h2><p className="text-xs text-muted-foreground">{visibleUsers.length} / {users.length} ta</p></div><Button variant="outline" size="icon" disabled={loading} onClick={() => void loadAdminData(adminKey)} aria-label="Yangilash"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /></Button></div>
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Ism, email yoki telefon bo‘yicha qidirish" className="pl-9" /></div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {visibleUsers.map((user) => <button key={user.id} disabled={loading} onClick={() => void openUser(user)} className={'w-full rounded-2xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-60 ' + (selected?.user.id === user.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border')}>
                  <div className="mb-2 flex items-center justify-between gap-3"><span className="truncate font-semibold">{user.full_name || 'Ism kiritilmagan'}</span><span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs">{user.login_count} kirish</span></div>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">{user.phone || 'Telefon kiritilmagan'} · {dateLabel(user.created_at)}</p>
                </button>)}
                {!visibleUsers.length && <p className="py-12 text-center text-sm text-muted-foreground">Mos foydalanuvchi topilmadi.</p>}
              </div>
            </section>

            <section className="glass min-h-[560px] overflow-hidden rounded-3xl">
              {!selected ? <div className="flex min-h-[560px] flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><Eye className="h-8 w-8" /></div><h2 className="text-xl font-semibold">Foydalanuvchini tanlang</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Hisob ma’lumotlari va saqlangan saytlarini ko‘rish uchun chap tomondagi ro‘yxatdan tanlang.</p></div> : loading ? <div className="flex min-h-[560px] flex-col items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p>Ma’lumotlar yuklanmoqda...</p></div> : <>
                <div className="border-b border-border p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">{(selected.user.full_name || selected.user.email).slice(0, 1).toUpperCase()}</div><div><h2 className="text-2xl font-bold">{selected.user.full_name || 'Ism kiritilmagan'}</h2><p className="mt-1 text-sm text-muted-foreground">Foydalanuvchi akkaunti</p></div></div><Button variant="outline" onClick={() => void createResetLink()} disabled={loading}><KeyRound className="mr-2 h-4 w-4" />Tiklash havolasi</Button></div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Info label="Ism-familiya" value={selected.user.full_name || 'Kiritilmagan'} /><Info label="Email manzil" value={<a className="text-primary underline underline-offset-2" href={'mailto:' + selected.user.email}>{selected.user.email}</a>} /><Info label="Telefon raqami" value={selected.user.phone ? <a className="text-primary underline underline-offset-2" href={'https://t.me/+' + selected.user.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer">{selected.user.phone}</a> : 'Kiritilmagan'} /><Info label="Ro‘yxatdan o‘tgan" value={dateLabel(selected.user.created_at)} /><Info label="Oxirgi kirish" value={dateLabel(selected.user.last_login_at)} /><Info label="Jami kirish" value={selected.user.login_count} /><Info label="Kategoriyalar" value={selected.categories.length} /><Info label="Saytlar" value={selected.links.length} /></div>
                  {resetUrl && <div className="mt-4 flex gap-2"><Input readOnly value={resetUrl} /><Button variant="outline" size="icon" onClick={() => { void navigator.clipboard.writeText(resetUrl); toast.success('Havola nusxalandi.'); }} aria-label="Havolani nusxalash"><Copy className="h-4 w-4" /></Button></div>}
                </div>
                <div className="p-5 sm:p-7">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Saqlangan saytlar</h3><p className="text-xs text-muted-foreground">{visibleLinks.length} / {selected.links.length} ta natija</p></div><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder="Sayt nomi yoki manzilini qidirish" className="pl-9" /></div></div>
                  <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">{visibleLinks.map((link) => <article key={link.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center"><div className="min-w-0"><p className="font-medium">{link.title}</p><a className="mt-1 block break-all text-sm text-primary underline decoration-primary/40 underline-offset-4" href={link.url} target="_blank" rel="noreferrer">{link.url}</a><p className="mt-2 text-xs text-muted-foreground">Qo‘shilgan: {dateLabel(link.created_at)}</p></div><Button variant="outline" size="sm" onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}>Ochish</Button></article>)}{!visibleLinks.length && <p className="py-12 text-center text-sm text-muted-foreground">Qidiruvga mos sayt topilmadi.</p>}</div>
                </div>
              </>}
            </section>
          </div>
        </>}
      </div>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-[min(560px,94vw)] overflow-y-auto border-border bg-background/95 p-0 backdrop-blur-xl sm:max-w-xl">
          <div className="border-b border-border p-6 pr-14"><SheetHeader><SheetTitle className="flex items-center gap-2 text-xl"><Bell className="h-5 w-5 text-primary" />Bildirishnomalar{unreadCount > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{unreadCount}</span>}</SheetTitle><SheetDescription>Har bir xabarni ochib o‘qilgan deb belgilang yoki barchasini birgalikda belgilang.</SheetDescription></SheetHeader><div className="mt-4 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={notificationQuery} onChange={(event) => setNotificationQuery(event.target.value)} placeholder="Email, ism yoki telefon bo‘yicha qidirish" className="pl-9" /></div><Button variant="outline" size="sm" disabled={!unreadCount} onClick={() => void markNotificationsSeen()}><CheckCheck className="mr-2 h-4 w-4" />Hammasini o‘qildi</Button></div></div>
          <div className="space-y-4 p-5">{visibleRequests.map((request) => <article key={request.id} onClick={() => { if (!request.admin_seen_at) void markNotificationsSeen(request.id); }} className={'cursor-pointer rounded-2xl border bg-card/60 p-4 shadow-sm transition-colors ' + (request.admin_seen_at ? 'border-border' : 'border-primary/40 ring-1 ring-primary/10')}>
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="font-semibold">Parolni tiklash so‘rovi {request.admin_seen_at && <span className="ml-1 text-xs font-normal text-muted-foreground">· O‘qildi</span>}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(request.created_at)}</p></div><span className={'rounded-full px-2.5 py-1 text-xs font-medium ' + (request.status === 'completed' ? 'bg-primary/10 text-primary' : request.identity_matches ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive')}>{request.status === 'completed' ? 'Yakunlandi' : request.status === 'code_issued' ? 'Kod yuborildi' : request.identity_matches ? 'Ma’lumotlar mos' : 'Ma’lumotlar mos emas'}</span></div>
            <dl className="grid gap-2 rounded-xl bg-secondary/40 p-3 text-sm"><Info label="Email" value={<a className="text-primary underline underline-offset-2" href={'mailto:' + request.email}>{request.email}</a>} /><Info label="Ism-familiya" value={request.full_name} /><Info label="Telefon" value={<a className="text-primary underline underline-offset-2" href={'https://t.me/+' + request.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer">{request.phone}</a>} /><Info label="Akkauntdagi ism" value={request.registered_full_name || 'Topilmadi'} /><Info label="Akkauntdagi telefon" value={request.registered_phone ? <a className="text-primary underline underline-offset-2" href={'https://t.me/+' + request.registered_phone.replace(/\D/g, '')} target="_blank" rel="noreferrer">{request.registered_phone}</a> : 'Topilmadi'} /></dl>
            {issuedCodes[request.id] && <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/5 p-3"><code className="flex-1 font-mono text-sm">{issuedCodes[request.id]}</code><Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(issuedCodes[request.id]); toast.success('Kod nusxalandi.'); }}><Copy className="mr-2 h-3.5 w-3.5" />Nusxalash</Button></div>}
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Kod 30 daqiqa amal qiladi va sahifaga avtomatik boradi.</p><Button size="sm" variant={request.status === 'code_issued' ? 'outline' : 'hero'} disabled={loading || request.status === 'completed' || !request.identity_matches} onClick={() => void issueRecoveryCode(request)}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : request.status === 'completed' ? <Check className="mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}{request.status === 'code_issued' ? 'Yangi kod' : request.status === 'completed' ? 'Yakunlandi' : 'Kod berish'}</Button></div>
          </article>)}{!visibleRequests.length && <div className="py-16 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" /><p className="font-medium">{requests.length ? 'Qidiruvga mos xabar topilmadi.' : 'Yangi bildirishnoma yo‘q'}</p><p className="mt-1 text-sm text-muted-foreground">Parol tiklash so‘rovlari shu yerda ko‘rinadi.</p></div>}</div>
        </SheetContent>
      </Sheet>
    </main>
  );
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="glass rounded-2xl p-5 sm:p-6"><div className="mb-3 flex items-center gap-2 text-primary">{icon}<span className="text-sm text-muted-foreground">{label}</span></div><p className="text-3xl font-bold tracking-tight">{value.toLocaleString('uz-UZ')}</p></div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl bg-secondary/50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>;
}

export default Admin;
