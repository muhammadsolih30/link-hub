const KEYS = {
  users: 'link-hub-demo-users',
  sessions: 'link-hub-demo-sessions',
  links: 'link-hub-demo-links',
  categories: 'link-hub-demo-categories',
};

interface DemoUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  salt: string;
  password_hash: string;
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
    write(KEYS.sessions, [...read<DemoSession>(KEYS.sessions), { token, user_id: user.id }]);
    return { user: publicUser(user), token } as T;
  }

  if (path === '/auth/me' && method === 'GET') return { user: publicUser(requireUser()) } as T;

  const user = requireUser();
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
