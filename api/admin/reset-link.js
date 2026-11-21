import { isAdminRequest, makeResetToken, hashResetToken, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db, body }) => {
  if (!isAdminRequest(req)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  if (req.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const userId = String(body.user_id || '');
  const [user] = await db.query('SELECT id FROM app_users WHERE id = $1', [userId]);
  if (!user) return { status: 404, body: { error: 'Foydalanuvchi topilmadi.' } };
  const token = makeResetToken();
  const tokenHash = hashResetToken(token);
  await db.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
  await db.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, now() + interval '30 minutes')`, [userId, tokenHash]);
  await db.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('site-admin', $1, 'create_password_reset_link')", [userId]);
  const origin = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.headers.origin || '');
  return { body: { reset_url: `${origin}/reset-password?token=${token}`, expires_in_minutes: 30 } };
});
