import { runApi, validEmail, validPhone, hashPassword, makeToken, publicUser } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db, body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');
  if (!validEmail(email)) return { status: 400, body: { error: 'Email manzil noto\'g\'ri.' } };
  if (password.length < 8 || password.length > 72) return { status: 400, body: { error: 'Parol 8–72 ta belgidan iborat bo\'lsin.' } };
  if (fullName.length < 2 || fullName.length > 100) return { status: 400, body: { error: 'Ism-familiya 2–100 ta belgidan iborat bo\'lsin.' } };
  if (!validPhone(phone)) return { status: 400, body: { error: 'Telefon raqamini to\'g\'ri kiriting.' } };
  try {
    const passwordHash = await hashPassword(password);
    const [user] = await db.query('INSERT INTO app_users (email, password_hash, full_name, phone, login_count, last_login_at) VALUES ($1, $2, $3, $4, 1, now()) RETURNING id, email, full_name, phone, session_version', [email, passwordHash, fullName, phone]);
    return { status: 201, body: { user: publicUser(user), token: makeToken(user) } };
  } catch (error) {
    if (error.code === '23505') return { status: 409, body: { error: 'Bu email allaqachon ro\'yxatdan o\'tgan.' } };
    throw error;
  }
});
