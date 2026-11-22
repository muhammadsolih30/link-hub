import { isAdminRequest, runApi } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db }) => {
  if (!isAdminRequest(req)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  const userId = String(req.query?.user_id || '');
  const [user] = await db.query(`SELECT id, email, full_name, phone, login_count, last_login_at, created_at
    FROM app_users WHERE id = $1`, [userId]);
  if (!user) return { status: 404, body: { error: 'Foydalanuvchi topilmadi.' } };
  await db.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('site-admin', $1, 'view_user')", [userId]);
  const [links, categories] = await Promise.all([
    db.query('SELECT id, title, url, category_id, created_at, updated_at FROM links WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    db.query('SELECT id, name, created_at FROM categories WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
  ]);
  return { body: { user, links, categories } };
});
