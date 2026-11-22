import { runApi, comparePassword, makeToken, publicUser } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db, body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const [found] = await db.query('SELECT id, email, full_name, phone, password_hash FROM app_users WHERE email = $1', [email]);
  if (!found || !(await comparePassword(password, found.password_hash))) return { status: 401, body: { error: 'Email yoki parol noto\'g\'ri.' } };
  const [user] = await db.query('UPDATE app_users SET login_count = login_count + 1, last_login_at = now() WHERE id = $1 RETURNING id, email, full_name, phone, session_version', [found.id]);
  return { body: { user: publicUser(user), token: makeToken(user) } };
});
