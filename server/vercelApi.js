import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

let schemaReady;
let sql;

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('Vercel Environment Variables ichida DATABASE_URL sozlanmagan.');
  if (!process.env.JWT_SECRET) throw new Error('Vercel Environment Variables ichida JWT_SECRET sozlanmagan.');
  if (process.env.JWT_SECRET.length < 32) throw new Error('Vercel Environment Variables: JWT_SECRET kamida 32 belgidan iborat bo\'lsin.');
  sql ||= neon(process.env.DATABASE_URL);
  return sql;
}

async function ensureSchema() {
  const db = getSql();
  schemaReady ||= (async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS app_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
      password_hash text NOT NULL, full_name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
      login_count integer NOT NULL DEFAULT 0, last_login_at timestamptz, session_version integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT ''");
    await db.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT ''");
    await db.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0');
    await db.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz');
    await db.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0');
    await db.query(`CREATE TABLE IF NOT EXISTS categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(50) NOT NULL,
      user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(100) NOT NULL,
      url text NOT NULL, category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
      user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS password_recovery_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, full_name text NOT NULL,
      phone text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz, admin_seen_at timestamptz
    )`);
    await db.query('ALTER TABLE password_recovery_requests ADD COLUMN IF NOT EXISTS admin_seen_at timestamptz');
    await db.query(`CREATE TABLE IF NOT EXISTS password_recovery_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      request_id uuid NOT NULL REFERENCES password_recovery_requests(id) ON DELETE CASCADE,
      code_hash text NOT NULL UNIQUE, code_ciphertext text, expires_at timestamptz NOT NULL, used_at timestamptz, verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query('ALTER TABLE password_recovery_codes ADD COLUMN IF NOT EXISTS verified_at timestamptz');
    await db.query('ALTER TABLE password_recovery_codes ADD COLUMN IF NOT EXISTS code_ciphertext text');
    await db.query(`CREATE TABLE IF NOT EXISTS admin_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_actor text NOT NULL,
      user_id uuid REFERENCES app_users(id) ON DELETE SET NULL, action text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  })().catch((error) => { schemaReady = undefined; throw error; });
  await schemaReady;
  return db;
}

function respond(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

async function getUser(req, db) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [user] = await db.query('SELECT id, email, full_name, phone, session_version FROM app_users WHERE id = $1', [payload.sub]);
    return user && (payload.ver || 0) === user.session_version ? user : null;
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return null;
    throw error;
  }
}

export async function runApi(req, res, action) {
  try {
    const db = await ensureSchema();
    const result = await action({ req, db, body: readBody(req), getUser: (request) => getUser(request, db) });
    if (result?.status === 204) { res.statusCode = 204; return res.end(); }
    return respond(res, result?.status || 200, result?.body ?? {});
  } catch (error) {
    console.error('Vercel API error:', error);
    const envError = /Environment Variables/.test(error.message || '');
    return respond(res, envError ? 503 : 500, {
      error: envError ? error.message : 'Neon bazasiga ulanishda xatolik. Vercel sozlamalaridagi DATABASE_URL va Neon holatini tekshiring.',
    });
  }
}

export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
export const validPhone = (phone) => /^\+?[0-9()\s-]{7,20}$/.test(phone);
export const publicUser = ({ id, email, full_name = '', phone = '' }) => ({ id, email, full_name, phone });
export const makeToken = (user) => jwt.sign({ sub: user.id, ver: user.session_version || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
export const hashPassword = (password) => bcrypt.hash(password, 12);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);
export const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');
export const makeResetToken = () => randomBytes(32).toString('hex');
export const makeRecoveryCode = () => randomBytes(6).toString('hex').toUpperCase();
export function encryptRecoveryCode(code) {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(process.env.JWT_SECRET).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString('base64url')).join('.');
}
export function decryptRecoveryCode(value) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const key = createHash('sha256').update(process.env.JWT_SECRET).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
export function isAdminRequest(req) {
  const expected = process.env.ADMIN_API_KEY;
  const supplied = req.headers['x-admin-key'];
  if (typeof expected !== 'string' || expected.length < 12 || typeof supplied !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
