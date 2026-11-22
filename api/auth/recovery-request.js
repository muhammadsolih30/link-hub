import { validEmail, validPhone, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body }) => {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!validEmail(email) || fullName.length < 2 || fullName.length > 100 || !validPhone(phone)) {
    return { status: 400, body: { error: 'Email, ism va telefon raqamni to\'g\'ri kiriting.' } };
  }
  const [user] = await db.query('SELECT id FROM app_users WHERE email = $1', [email]);
  if (user) {
    const [recent] = await db.query("SELECT COUNT(*)::int AS count FROM password_recovery_requests WHERE email = $1 AND created_at > now() - interval '1 hour'", [email]);
    if (recent.count < 3) await db.query('INSERT INTO password_recovery_requests (email, full_name, phone) VALUES ($1, $2, $3)', [email, fullName, phone]);
  }
  return { body: { ok: true, message: 'Agar akkaunt topilsa, yordam so\'rovi adminga yuborildi.' } };
});

