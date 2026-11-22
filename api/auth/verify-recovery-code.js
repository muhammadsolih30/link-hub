import { hashResetToken, validEmail, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body }) => {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim().toUpperCase();
  if (!validEmail(email) || !/^[A-F0-9]{12}$/.test(code)) return { status: 400, body: { error: 'Email yoki maxsus kod noto\'g\'ri.' } };
  const rows = await db.query(`UPDATE password_recovery_codes SET verified_at = now()
    WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
      AND user_id = (SELECT id FROM app_users WHERE email = $2)
    RETURNING id`, [hashResetToken(code), email]);
  if (!rows.length) return { status: 400, body: { error: 'Kod noto\'g\'ri, eskirgan yoki boshqa emailga tegishli.' } };
  return { body: { ok: true } };
});
