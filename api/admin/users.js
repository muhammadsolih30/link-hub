import { isAdminRequest, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db }) => {
  if (!isAdminRequest(req)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  const users = await db.query(`SELECT id, email, full_name, phone, login_count, last_login_at, created_at
    FROM app_users ORDER BY created_at DESC`);
  return { body: users };
});
