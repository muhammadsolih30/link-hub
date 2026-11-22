import { comparePassword, hashPassword, makeToken, runApi } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body, getUser }) => {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const user = await getUser(request);
  if (!user) return { status: 401, body: { error: 'Tizimga qayta kiring.' } };
  const currentPassword = String(body.current_password || '');
  const newPassword = String(body.new_password || '');
  if (newPassword.length < 8 || newPassword.length > 72) return { status: 400, body: { error: 'Yangi parol 8–72 ta belgidan iborat bo\'lsin.' } };
  const [row] = await db.query('SELECT password_hash FROM app_users WHERE id = $1', [user.id]);
  if (!row || !(await comparePassword(currentPassword, row.password_hash))) return { status: 400, body: { error: 'Amaldagi parol noto\'g\'ri.' } };
  const hash = await hashPassword(newPassword);
  const [updated] = await db.query('UPDATE app_users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING id, session_version', [hash, user.id]);
  return { body: { token: makeToken(updated) } };
});

