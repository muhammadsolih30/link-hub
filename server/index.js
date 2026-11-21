import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const { DATABASE_URL, JWT_SECRET } = process.env;
if (!DATABASE_URL || !JWT_SECRET) throw new Error('DATABASE_URL va JWT_SECRET server .env faylida sozlanishi kerak.');
const sql = neon(DATABASE_URL);

await sql.query(`CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text NOT NULL, full_name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  login_count integer NOT NULL DEFAULT 0, last_login_at timestamptz, session_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
)`);
await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT ''");
await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT ''");
await sql.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0');
await sql.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz');
await sql.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0');
await sql.query(`CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(50) NOT NULL,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
)`);
await sql.query(`CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(100) NOT NULL,
  url text NOT NULL, category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
)`);
await sql.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)`);
await sql.query(`CREATE TABLE IF NOT EXISTS admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_actor text NOT NULL,
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL, action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`);

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:8080' }));
app.use(express.json({ limit: '32kb' }));
const publicUser = ({ id, email, full_name = '', phone = '' }) => ({ id, email, full_name, phone });
const makeToken = (user) => jwt.sign({ sub: user.id, ver: user.session_version || 0 }, JWT_SECRET, { expiresIn: '7d' });
const adminAuth = (req, res, next) => {
  const expected = process.env.ADMIN_API_KEY;
  const supplied = req.headers['x-admin-key'];
  if (typeof expected !== 'string' || expected.length < 12 || typeof supplied !== 'string') return res.status(401).json({ error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' });
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return res.status(401).json({ error: 'Admin kaliti noto\'g\'ri.' });
  req.adminActor = 'site-admin';
  next();
};

const auth = async (req, res, next) => {
  let payload;
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Tizimga kiring.' });
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sessiya muddati tugagan. Qayta kiring.' });
  }
  try {
    const [user] = await sql.query('SELECT id, email, full_name, phone, session_version FROM app_users WHERE id = $1', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'Akkaunt topilmadi.' });
    if ((payload.ver || 0) !== user.session_version) return res.status(401).json({ error: 'Sessiya tugagan. Qayta kiring.' });
    req.user = user;
    next();
  } catch (error) { next(error); }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.full_name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ error: 'Email manzil noto\'g\'ri.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Parol 8–72 ta belgidan iborat bo\'lsin.' });
  if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ error: 'Ism-familiya 2–100 ta belgidan iborat bo\'lsin.' });
  if (!/^\+?[0-9()\s-]{7,20}$/.test(phone)) return res.status(400).json({ error: 'Telefon raqamini to\'g\'ri kiriting.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const [user] = await sql.query('INSERT INTO app_users (email, password_hash, full_name, phone, login_count, last_login_at) VALUES ($1, $2, $3, $4, 1, now()) RETURNING id, email, full_name, phone', [email, hash, fullName, phone]);
    return res.status(201).json({ user: publicUser(user), token: makeToken(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan.' });
    next(error);
  }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const [found] = await sql.query('SELECT id, email, full_name, phone, password_hash FROM app_users WHERE email = $1', [email]);
    if (!found || !(await bcrypt.compare(password, found.password_hash))) return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri.' });
    const [user] = await sql.query('UPDATE app_users SET login_count = login_count + 1, last_login_at = now() WHERE id = $1 RETURNING id, email, full_name, phone, session_version', [found.id]);
    return res.json({ user: publicUser(user), token: makeToken(user) });
  } catch (error) { next(error); }
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/reset-password', async (req, res, next) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!token) return res.status(400).json({ error: 'Tiklash havolasi noto\'g\'ri.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Yangi parol 8–72 ta belgidan iborat bo\'lsin.' });
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql.query(`WITH valid_reset AS (
      UPDATE password_reset_tokens SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id
    )
    UPDATE app_users SET password_hash = $2, session_version = session_version + 1
    FROM valid_reset WHERE app_users.id = valid_reset.user_id RETURNING app_users.id`, [tokenHash, passwordHash]);
    if (!rows.length) return res.status(400).json({ error: 'Parolni tiklash havolasi eskirgan yoki ishlatilgan.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/admin/summary', adminAuth, async (_req, res, next) => {
  try {
    const [[users], [links], [logins]] = await Promise.all([
      sql.query('SELECT COUNT(*)::int AS count FROM app_users'),
      sql.query('SELECT COUNT(*)::int AS count FROM links'),
      sql.query('SELECT COALESCE(SUM(login_count), 0)::int AS count FROM app_users'),
    ]);
    res.json({ users: users.count, links: links.count, logins: logins.count });
  } catch (error) { next(error); }
});
app.get('/api/admin/users', adminAuth, async (_req, res, next) => {
  try { res.json(await sql.query('SELECT id, email, full_name, phone, login_count, last_login_at, created_at FROM app_users ORDER BY created_at DESC')); }
  catch (error) { next(error); }
});
app.get('/api/admin/user', adminAuth, async (req, res, next) => {
  const userId = String(req.query.user_id || '');
  try {
    const [user] = await sql.query('SELECT id, email, full_name, phone, login_count, last_login_at, created_at FROM app_users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    await sql.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('site-admin', $1, 'view_user')", [userId]);
    const [links, categories] = await Promise.all([
      sql.query('SELECT id, title, url, category_id, created_at, updated_at FROM links WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      sql.query('SELECT id, name, created_at FROM categories WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    ]);
    res.json({ user, links, categories });
  } catch (error) { next(error); }
});
app.post('/api/admin/reset-link', adminAuth, async (req, res, next) => {
  const userId = String(req.body?.user_id || '');
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    const [user] = await sql.query('SELECT id FROM app_users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    await sql.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await sql.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')", [userId, tokenHash]);
    await sql.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('site-admin', $1, 'create_password_reset_link')", [userId]);
    const origin = process.env.APP_URL || req.headers.origin || '';
    res.json({ reset_url: `${origin}/reset-password?token=${token}`, expires_in_minutes: 30 });
  } catch (error) { next(error); }
});

app.get('/api/categories', auth, async (req, res, next) => {
  try { res.json(await sql.query('SELECT id, name, user_id, created_at FROM categories WHERE user_id = $1 ORDER BY created_at ASC', [req.user.id])); }
  catch (error) { next(error); }
});
app.post('/api/categories', auth, async (req, res, next) => {
  const name = String(req.body?.name || '').trim();
  if (!name || name.length > 50) return res.status(400).json({ error: 'Kategoriya nomi 1–50 belgi bo\'lsin.' });
  try {
    const [row] = await sql.query('INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING id, name, user_id, created_at', [name, req.user.id]);
    res.status(201).json(row);
  } catch (error) { next(error); }
});
app.delete('/api/categories/:id', auth, async (req, res, next) => {
  try { await sql.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]); res.status(204).end(); }
  catch (error) { next(error); }
});
app.post('/api/categories/delete', auth, async (req, res, next) => {
  try { await sql.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [req.body.id, req.user.id]); res.status(204).end(); }
  catch (error) { next(error); }
});

app.get('/api/links', auth, async (req, res, next) => {
  try { res.json(await sql.query('SELECT id, title, url, category_id, user_id, created_at, updated_at FROM links WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])); }
  catch (error) { next(error); }
});
app.post('/api/links', auth, async (req, res, next) => {
  const { title, url, category_id = null } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 100) return res.status(400).json({ error: 'Link nomi 1–100 belgi bo\'lsin.' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'To\'g\'ri URL manzil kiriting.' }); }
  try {
    const [row] = await sql.query('INSERT INTO links (title, url, category_id, user_id) VALUES ($1, $2, $3, $4) RETURNING id, title, url, category_id, user_id, created_at, updated_at', [title.trim(), url, category_id || null, req.user.id]);
    res.status(201).json(row);
  } catch (error) { next(error); }
});
app.put('/api/links/update', auth, async (req, res, next) => {
  const { id, title, url, category_id = null } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 100) return res.status(400).json({ error: 'Link nomi 1–100 belgi bo\'lsin.' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'To\'g\'ri URL manzil kiriting.' }); }
  try {
    const [row] = await sql.query('UPDATE links SET title = $1, url = $2, category_id = $3, updated_at = now() WHERE id = $4 AND user_id = $5 RETURNING id', [title.trim(), url, category_id || null, id, req.user.id]);
    if (!row) return res.status(404).json({ error: 'Link topilmadi.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/links/delete', auth, async (req, res, next) => {
  try { await sql.query('DELETE FROM links WHERE id = $1 AND user_id = $2', [req.body.id, req.user.id]); res.status(204).end(); }
  catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error('API error:', error);
  res.status(500).json({ error: 'Serverda kutilmagan xatolik yuz berdi.' });
});
const port = Number(process.env.API_PORT || 3001);
app.listen(port, () => console.log(`Link Hub API listening on http://localhost:${port}`));
