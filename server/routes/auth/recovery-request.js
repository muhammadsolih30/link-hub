import { encryptRecoveryCode, hashResetToken, makeRecoveryCode, validEmail, validPhone, runApi } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body }) => {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!validEmail(email) || fullName.length < 2 || fullName.length > 100 || !validPhone(phone)) {
    return { status: 400, body: { error: 'Email, ism va telefon raqamni to\'g\'ri kiriting.' } };
  }

  const [user] = await db.query('SELECT id, phone FROM app_users WHERE email = $1', [email]);
  const digits = (value) => String(value || '').replace(/\D/g, '');
  if (!user || digits(user.phone) !== digits(phone)) {
    return { status: 400, body: { error: 'Siz kiritgan email yoki telefon raqami xato. Iltimos, tekshirib qaytadan so\'rov yuboring.' } };
  }

  const [recent] = await db.query("SELECT COUNT(*)::int AS count FROM password_recovery_requests WHERE email = $1 AND created_at > now() - interval '1 hour'", [email]);
  if (recent.count >= 3) return { status: 429, body: { error: 'Bir soatda 3 ta so\'rov yuborish mumkin. Keyinroq qayta urinib ko\'ring.' } };

  await db.query('UPDATE password_recovery_codes SET used_at = now(), code_ciphertext = NULL WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  const [recoveryRequest] = await db.query(`INSERT INTO password_recovery_requests
    (email, full_name, phone, status, admin_seen_at) VALUES ($1, $2, $3, 'code_issued', now()) RETURNING id`, [email, fullName, phone]);
  const code = makeRecoveryCode();
  await db.query(`INSERT INTO password_recovery_codes (user_id, request_id, code_hash, code_ciphertext, expires_at)
    VALUES ($1, $2, $3, $4, now() + interval '30 minutes')`, [user.id, recoveryRequest.id, hashResetToken(code), encryptRecoveryCode(code)]);
  return { body: { ok: true, message: 'Email va telefon tasdiqlandi. Kod shu sahifaga avtomatik yuboriladi.' } };
});
