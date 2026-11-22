import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

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
await sql.query(`CREATE TABLE IF NOT EXISTS password_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, full_name text NOT NULL,
  phone text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz, admin_seen_at timestamptz
)`);
await sql.query('ALTER TABLE password_recovery_requests ADD COLUMN IF NOT EXISTS admin_seen_at timestamptz');
await sql.query(`CREATE TABLE IF NOT EXISTS password_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES password_recovery_requests(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE, code_ciphertext text, expires_at timestamptz NOT NULL, used_at timestamptz, verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)`);
await sql.query('ALTER TABLE password_recovery_codes ADD COLUMN IF NOT EXISTS verified_at timestamptz');
await sql.query('ALTER TABLE password_recovery_codes ADD COLUMN IF NOT EXISTS code_ciphertext text');
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
const encryptRecoveryCode = (code) => {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(JWT_SECRET).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString('base64url')).join('.');
};
const decryptRecoveryCode = (value) => {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const key = createHash('sha256').update(JWT_SECRET).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};
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
app.post('/api/auth/change-password', auth, async (req, res, next) => {
  const currentPassword = String(req.body?.current_password || '');
  const newPassword = String(req.body?.new_password || '');
  if (newPassword.length < 8 || newPassword.length > 72) return res.status(400).json({ error: 'Yangi parol 8–72 ta belgidan iborat bo\'lsin.' });
  try {
    const [found] = await sql.query('SELECT password_hash FROM app_users WHERE id = $1', [req.user.id]);
    if (!found || !(await bcrypt.compare(currentPassword, found.password_hash))) return res.status(400).json({ error: 'Amaldagi parol noto\'g\'ri.' });
    const hash = await bcrypt.hash(newPassword, 12);
    const [user] = await sql.query('UPDATE app_users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING id, session_version', [hash, req.user.id]);
    return res.json({ token: makeToken(user) });
  } catch (error) { next(error); }
});
app.post('/api/auth/recovery-request', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const fullName = String(req.body?.full_name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 100 || !/^\+?[0-9()\s-]{7,20}$/.test(phone)) return res.status(400).json({ error: 'Email, ism va telefon raqamni to\'g\'ri kiriting.' });
  try {
    const [user] = await sql.query('SELECT id FROM app_users WHERE email = $1', [email]);
    if (user) {
      const [recent] = await sql.query("SELECT COUNT(*)::int AS count FROM password_recovery_requests WHERE email = $1 AND created_at > now() - interval '1 hour'", [email]);
      if (recent.count < 3) await sql.query('INSERT INTO password_recovery_requests (email, full_name, phone) VALUES ($1, $2, $3)', [email, fullName, phone]);
    }
    return res.json({ ok: true, message: 'Agar akkaunt topilsa, yordam so\'rovi adminga yuborildi.' });
  } catch (error) { next(error); }
});
app.post('/api/auth/recover-with-code', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim().toUpperCase();
  const password = String(req.body?.new_password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[A-F0-9]{12}$/.test(code)) return res.status(400).json({ error: 'Email yoki maxsus kod noto\'g\'ri.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Yangi parol 8–72 ta belgidan iborat bo\'lsin.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const codeHash = createHash('sha256').update(code).digest('hex');
    const rows = await sql.query(`WITH valid_code AS (
      UPDATE password_recovery_codes SET used_at = now(), code_ciphertext = NULL
      WHERE code_hash = $1 AND used_at IS NULL AND verified_at IS NOT NULL AND expires_at > now()
        AND user_id = (SELECT id FROM app_users WHERE email = $2)
      RETURNING user_id, request_id
    ), updated_user AS (
      UPDATE app_users SET password_hash = $3, session_version = session_version + 1
      FROM valid_code WHERE app_users.id = valid_code.user_id RETURNING app_users.id
    )
    UPDATE password_recovery_requests SET status = 'completed', reviewed_at = now()
    WHERE id IN (SELECT request_id FROM valid_code) RETURNING id`, [codeHash, email, hash]);
    if (!rows.length) return res.status(400).json({ error: 'Maxsus kod noto\'g\'ri, eskirgan yoki ishlatilgan.' });
    return res.json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/auth/verify-recovery-code', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[A-F0-9]{12}$/.test(code)) return res.status(400).json({ error: 'Email yoki maxsus kod noto\'g\'ri.' });
  try {
    const codeHash = createHash('sha256').update(code).digest('hex');
    const rows = await sql.query(`UPDATE password_recovery_codes SET verified_at = now()
      WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
        AND user_id = (SELECT id FROM app_users WHERE email = $2)
      RETURNING id`, [codeHash, email]);
    if (!rows.length) return res.status(400).json({ error: 'Kod noto\'g\'ri, eskirgan yoki boshqa emailga tegishli.' });
    return res.json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/auth/recovery-status', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[0-9()\s-]{7,20}$/.test(phone)) return res.status(400).json({ error: 'Email va telefon raqamni tekshiring.' });
  try {
    const [row] = await sql.query(`SELECT c.code_ciphertext, c.expires_at
      FROM password_recovery_codes c
      JOIN password_recovery_requests r ON r.id = c.request_id
      JOIN app_users u ON u.id = c.user_id
      WHERE r.email = $1 AND r.status = 'code_issued' AND c.used_at IS NULL AND c.expires_at > now()
        AND regexp_replace($2, '[^0-9]', '', 'g') = regexp_replace(u.phone, '[^0-9]', '', 'g')
      ORDER BY c.created_at DESC LIMIT 1`, [email, phone]);
    if (!row?.code_ciphertext) return res.json({ status: 'waiting' });
    return res.json({ status: 'ready', code: decryptRecoveryCode(row.code_ciphertext), expires_at: row.expires_at });
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
app.get('/api/admin/recovery-requests', adminAuth, async (_req, res, next) => {
  try {
    res.json(await sql.query(`SELECT r.id, r.email, r.full_name, r.phone, r.status, r.created_at, r.admin_seen_at,
      u.email AS registered_email, u.full_name AS registered_full_name, u.phone AS registered_phone,
      (u.id IS NOT NULL AND regexp_replace(r.phone, '[^0-9]', '', 'g') = regexp_replace(u.phone, '[^0-9]', '', 'g')) AS identity_matches
      FROM password_recovery_requests r LEFT JOIN app_users u ON u.email = r.email
      ORDER BY r.created_at DESC LIMIT 100`));
  } catch (error) { next(error); }
});
app.post('/api/admin/recovery-requests/seen', adminAuth, async (_req, res, next) => {
  try {
    const requestId = String(_req.body?.request_id || '');
    if (requestId) await sql.query('UPDATE password_recovery_requests SET admin_seen_at = now() WHERE id = $1 AND admin_seen_at IS NULL', [requestId]);
    else await sql.query('UPDATE password_recovery_requests SET admin_seen_at = now() WHERE admin_seen_at IS NULL');
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/admin/recovery-code', adminAuth, async (req, res, next) => {
  const requestId = String(req.body?.request_id || '');
  const code = randomBytes(6).toString('hex').toUpperCase();
  const codeHash = createHash('sha256').update(code).digest('hex');
  try {
    const [request] = await sql.query(`SELECT r.id, r.email, r.phone, u.id AS user_id, u.phone AS registered_phone
      FROM password_recovery_requests r LEFT JOIN app_users u ON u.email = r.email
      WHERE r.id = $1 AND r.status IN ('pending', 'code_issued')`, [requestId]);
    if (!request) return res.status(404).json({ error: 'Yordam so\'rovi topilmadi yoki yakunlangan.' });
    if (!request.user_id) return res.status(404).json({ error: 'Bu emailga tegishli akkaunt topilmadi.' });
    const digits = (value) => String(value || '').replace(/\D/g, '');
    if (digits(request.phone) !== digits(request.registered_phone)) return res.status(403).json({ error: 'Kiritilgan telefon raqami akkauntdagi raqamga mos kelmadi.' });
    await sql.query('UPDATE password_recovery_codes SET used_at = now(), code_ciphertext = NULL WHERE user_id = $1 AND used_at IS NULL', [request.user_id]);
    await sql.query(`INSERT INTO password_recovery_codes (user_id, request_id, code_hash, code_ciphertext, expires_at)
      VALUES ($1, $2, $3, $4, now() + interval '30 minutes')`, [request.user_id, requestId, codeHash, encryptRecoveryCode(code)]);
    await sql.query("UPDATE password_recovery_requests SET status = 'code_issued', reviewed_at = now() WHERE id = $1", [requestId]);
    await sql.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('site-admin', $1, 'issue_recovery_code')", [request.user_id]);
    return res.json({ code, expires_in_minutes: 30 });
  } catch (error) { next(error); }
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
