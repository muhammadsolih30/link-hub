const KEYS = {
  users: 'link-hub-demo-users',
  sessions: 'link-hub-demo-sessions',
  links: 'link-hub-demo-links',
  categories: 'link-hub-demo-categories',
  recoveryRequests: 'link-hub-demo-recovery-requests',
  recoveryCodes: 'link-hub-demo-recovery-codes',
};
const ADMIN_CODE = 'muhammadsolih1027';

interface DemoUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  salt: string;
  password_hash: string;
  created_at?: string;
  last_login_at?: string | null;
  login_count?: number;
}
interface DemoCategory { id: string; name: string; user_id: string; created_at: string }
interface DemoLink {
  id: string; title: string; url: string; category_id: string | null;
  user_id: string; created_at: string; updated_at: string;
}
interface DemoSession { token: string; user_id: string }

function read<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[]; }
  catch { return []; }
}
function write<T>(key: string, rows: T[]) { localStorage.setItem(key, JSON.stringify(rows)); }
function publicUser(user: DemoUser) {
  return { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone };
}
function randomId() { return crypto.randomUUID(); }
async function hashPassword(password: string, salt: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function requireUser() {
  const token = localStorage.getItem('link-hub-token');
  const session = read<DemoSession>(KEYS.sessions).find((row) => row.token === token);
  const user = session && read<DemoUser>(KEYS.users).find((row) => row.id === session.user_id);
  if (!user) throw new Error('Demo sessiya topilmadi. Qayta kiring.');
  return user;
}

export async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const id = path.split('/').filter(Boolean).at(-1);

  if (path === '/auth/register' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const users = read<DemoUser>(KEYS.users);
    if (users.some((user) => user.email === email)) throw new Error('Bu email allaqachon ro\'yxatdan o\'tgan.');
    const salt = randomId();
    const user: DemoUser = {
      id: randomId(), email,
      full_name: String(body.full_name || '').trim(),
      phone: String(body.phone || '').trim(),
      salt, password_hash: await hashPassword(String(body.password || ''), salt),
      created_at: new Date().toISOString(), last_login_at: new Date().toISOString(), login_count: 1,
    };
    users.push(user);
    write(KEYS.users, users);
    const token = randomId();
    write(KEYS.sessions, [...read<DemoSession>(KEYS.sessions), { token, user_id: user.id }]);
    return { user: publicUser(user), token } as T;
  }

  if (path === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const user = read<DemoUser>(KEYS.users).find((row) => row.email === email);
    if (!user || user.password_hash !== await hashPassword(String(body.password || ''), user.salt)) {
      throw new Error('Email yoki parol noto\'g\'ri.');
    }
    const token = randomId();
    user.login_count = (user.login_count || 0) + 1;
    user.last_login_at = new Date().toISOString();
    write(KEYS.users, read<DemoUser>(KEYS.users).map((row) => row.id === user.id ? user : row));
    write(KEYS.sessions, [...read<DemoSession>(KEYS.sessions), { token, user_id: user.id }]);
    return { user: publicUser(user), token } as T;
  }

  if (path === '/auth/me' && method === 'GET') return { user: publicUser(requireUser()) } as T;

  if (path === '/auth/recovery-request' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const user = read<DemoUser>(KEYS.users).find((row) => row.email === email);
    const digits = (value: string) => value.replace(/\D/g, '');
    if (!user || digits(user.phone) !== digits(String(body.phone || ''))) throw new Error('Siz kiritgan email yoki telefon raqami xato. Iltimos, tekshirib qaytadan so‘rov yuboring.');
    const requests = read<Array<{ id: string; email: string; full_name: string; phone: string; status: string; created_at: string }>>(KEYS.recoveryRequests);
    if (requests.filter((request) => request.email === email && Date.now() - new Date(request.created_at).getTime() < 60 * 60_000).length >= 3) throw new Error('Bir soatda 3 ta so‘rov yuborish mumkin. Keyinroq qayta urinib ko‘ring.');
    requests.unshift({ id: randomId(), email, full_name: String(body.full_name || '').trim(), phone: String(body.phone || '').trim(), status: 'pending', created_at: new Date().toISOString(), admin_seen_at: null });
    write(KEYS.recoveryRequests, requests);
    return { ok: true, message: 'Yordam so‘rovi adminga yuborildi.' } as T;
  }
  if (path === '/auth/recovery-status' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const user = read<DemoUser>(KEYS.users).find((row) => row.email === email && row.phone.replace(/\D/g, '') === phone);
    const requests = read<Array<{ id: string; email: string; status: string }>>(KEYS.recoveryRequests);
    const request = requests.find((row) => row.email === email && row.status === 'code_issued');
    const code = read<Array<{ code: string; email: string; request_id: string; expires_at: string; used: boolean }>>(KEYS.recoveryCodes)
      .find((row) => row.email === email && row.request_id === request?.id && !row.used && new Date(row.expires_at) > new Date());
    if (!user || !code) return { status: 'waiting' } as T;
    return { status: 'ready', code: code.code, expires_at: code.expires_at } as T;
  }
  if (path === '/auth/verify-recovery-code' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim().toUpperCase();
    const codes = read<Array<{ code: string; email: string; request_id: string; expires_at: string; used: boolean; verified?: boolean }>>(KEYS.recoveryCodes);
    const entry = codes.find((row) => row.email === email && row.code === code && !row.used && new Date(row.expires_at) > new Date());
    if (!entry) throw new Error('Kod noto\'g\'ri, eskirgan yoki boshqa emailga tegishli.');
    entry.verified = true;
    write(KEYS.recoveryCodes, codes);
    return { ok: true } as T;
  }
  if (path === '/auth/recover-with-code' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim().toUpperCase();
    const users = read<DemoUser>(KEYS.users);
    const user = users.find((row) => row.email === email);
    const codes = read<Array<{ code: string; email: string; request_id: string; expires_at: string; used: boolean; verified?: boolean }>>(KEYS.recoveryCodes);
    const entry = codes.find((row) => row.email === email && row.code === code && row.verified && !row.used && new Date(row.expires_at) > new Date());
    if (!user || !entry) throw new Error('Maxsus kod noto\'g\'ri, eskirgan yoki ishlatilgan.');
    entry.used = true;
    user.salt = randomId();
    user.password_hash = await hashPassword(String(body.new_password || ''), user.salt);
    write(KEYS.users, users);
    write(KEYS.recoveryCodes, codes);
    write(KEYS.recoveryRequests, read<Array<{ id: string; status: string }>>(KEYS.recoveryRequests).map((row) => row.id === entry.request_id ? { ...row, status: 'completed' } : row));
    return { ok: true } as T;
  }

  const user = requireUser();
  if (path === '/auth/change-password' && method === 'POST') {
    if (user.password_hash !== await hashPassword(String(body.current_password || ''), user.salt)) throw new Error('Amaldagi parol noto\'g\'ri.');
    user.salt = randomId();
    user.password_hash = await hashPassword(String(body.new_password || ''), user.salt);
    write(KEYS.users, read<DemoUser>(KEYS.users).map((row) => row.id === user.id ? user : row));
    return { ok: true } as T;
  }
  if (path === '/categories' && method === 'GET') {
    return read<DemoCategory>(KEYS.categories).filter((row) => row.user_id === user.id) as T;
  }
  if (path === '/categories' && method === 'POST') {
    const row: DemoCategory = { id: randomId(), name: String(body.name).trim(), user_id: user.id, created_at: new Date().toISOString() };
    write(KEYS.categories, [...read<DemoCategory>(KEYS.categories), row]);
    return row as T;
  }
  if ((path.startsWith('/categories/') && method === 'DELETE') || (path === '/categories/delete' && method === 'POST')) {
    const rowId = body.id || id;
    write(KEYS.categories, read<DemoCategory>(KEYS.categories).filter((row) => !(row.id === rowId && row.user_id === user.id)));
    write(KEYS.links, read<DemoLink>(KEYS.links).map((row) => row.user_id === user.id && row.category_id === rowId ? { ...row, category_id: null } : row));
    return undefined as T;
  }
  if (path === '/links' && method === 'GET') {
    return read<DemoLink>(KEYS.links).filter((row) => row.user_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)) as T;
  }
  if (path === '/links' && method === 'POST') {
    const now = new Date().toISOString();
    const row: DemoLink = { id: randomId(), title: String(body.title).trim(), url: String(body.url), category_id: body.category_id || null, user_id: user.id, created_at: now, updated_at: now };
    write(KEYS.links, [...read<DemoLink>(KEYS.links), row]);
    return row as T;
  }
  if ((path.startsWith('/links/') && method === 'PUT') || (path === '/links/update' && method === 'PUT')) {
    const rowId = body.id || id;
    const rows = read<DemoLink>(KEYS.links);
    const index = rows.findIndex((row) => row.id === rowId && row.user_id === user.id);
    if (index < 0) throw new Error('Link topilmadi.');
    rows[index] = { ...rows[index], title: String(body.title).trim(), url: String(body.url), category_id: body.category_id || null, updated_at: new Date().toISOString() };
    write(KEYS.links, rows);
    return { ok: true } as T;
  }
  if ((path.startsWith('/links/') && method === 'DELETE') || (path === '/links/delete' && method === 'POST')) {
    const rowId = body.id || id;
    write(KEYS.links, read<DemoLink>(KEYS.links).filter((row) => !(row.id === rowId && row.user_id === user.id)));
    return undefined as T;
  }
  throw new Error('Demo rejimida bu amal mavjud emas.');
}

export async function demoAdminRequest<T>(path: string, adminCode: string, options: RequestInit = {}): Promise<T> {
  if (adminCode !== ADMIN_CODE) throw new Error('Admin kodi noto\'g\'ri.');
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const users = read<DemoUser>(KEYS.users);
  const links = read<DemoLink>(KEYS.links);
  const categories = read<DemoCategory>(KEYS.categories);
  if (path === '/admin/summary') {
    return { users: users.length, links: links.length, logins: users.reduce((sum, user) => sum + (user.login_count || 0), 0) } as T;
  }
  if (path === '/admin/users') {
    return users.map((user) => ({ id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, login_count: user.login_count || 0, last_login_at: user.last_login_at || null, created_at: user.created_at || new Date(0).toISOString() })).sort((a, b) => b.created_at.localeCompare(a.created_at)) as T;
  }
  if (path.startsWith('/admin/user?')) {
    const userId = new URLSearchParams(path.split('?')[1]).get('user_id');
    const user = users.find((row) => row.id === userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');
    return {
      user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, login_count: user.login_count || 0, last_login_at: user.last_login_at || null, created_at: user.created_at || new Date(0).toISOString() },
      links: links.filter((row) => row.user_id === user.id),
      categories: categories.filter((row) => row.user_id === user.id),
    } as T;
  }
  if (path === '/admin/recovery-requests') {
    const requests = read<Array<{ email: string } & Record<string, unknown>>>(KEYS.recoveryRequests);
    return requests.map((request) => {
      const user = users.find((row) => row.email === request.email);
      const digits = (value: string) => value.replace(/\D/g, '');
      return { ...request, registered_email: user?.email || '', registered_full_name: user?.full_name || '', registered_phone: user?.phone || '', identity_matches: Boolean(user && digits(String(request.phone || '')) === digits(user.phone)) };
    }) as T;
  }
  if (path === '/admin/recovery-requests/seen' && options.method === 'POST') {
    const requests = read<Array<Record<string, unknown>>>(KEYS.recoveryRequests);
    const requestId = String(body.request_id || '');
    write(KEYS.recoveryRequests, requests.map((row) => (requestId ? row.id === requestId : true) && !row.admin_seen_at ? { ...row, admin_seen_at: new Date().toISOString() } : row));
    return { ok: true } as T;
  }
  if (path === '/admin/recovery-code' && options.method === 'POST') {
    const requests = read<Array<{ id: string; email: string; status: string; phone: string }>>(KEYS.recoveryRequests);
    const request = requests.find((row) => row.id === body.request_id && row.status !== 'completed');
    if (!request) throw new Error('Yordam so\'rovi topilmadi yoki yakunlangan.');
    const user = users.find((row) => row.email === request.email);
    const digits = (value: string) => value.replace(/\D/g, '');
    if (!user || digits(String(request.phone || '')) !== digits(user.phone)) throw new Error('Kiritilgan telefon raqami akkauntdagi raqamga mos kelmadi.');
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    write(KEYS.recoveryRequests, requests.map((row) => row.id === request.id ? { ...row, status: 'code_issued' } : row));
    const codes = read<Array<{ code: string; email: string; request_id: string; expires_at: string; used: boolean }>>(KEYS.recoveryCodes).filter((row) => row.email !== request.email);
    codes.push({ code, email: request.email, request_id: request.id, expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), used: false });
    write(KEYS.recoveryCodes, codes);
    return { code, expires_in_minutes: 30 } as T;
  }
  throw new Error('Bu amal lokal rejimda mavjud emas.');
}
