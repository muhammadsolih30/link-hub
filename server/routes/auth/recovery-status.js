import { decryptRecoveryCode, validEmail, validPhone, runApi } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body }) => {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  if (!validEmail(email) || !validPhone(phone)) return { status: 400, body: { error: 'Email va telefon raqamni tekshiring.' } };
  const [row] = await db.query(`SELECT c.code_ciphertext, c.expires_at
    FROM password_recovery_codes c
    JOIN password_recovery_requests r ON r.id = c.request_id
    JOIN app_users u ON u.id = c.user_id
    WHERE r.email = $1 AND r.status = 'code_issued' AND c.used_at IS NULL AND c.expires_at > now()
      AND regexp_replace($2, '[^0-9]', '', 'g') = regexp_replace(u.phone, '[^0-9]', '', 'g')
    ORDER BY c.created_at DESC LIMIT 1`, [email, phone]);
  if (!row?.code_ciphertext) return { body: { status: 'waiting' } };
  return { body: { status: 'ready', code: decryptRecoveryCode(row.code_ciphertext), expires_at: row.expires_at } };
});
