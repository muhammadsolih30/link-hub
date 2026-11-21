import { isAdminRequest, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db }) => {
  if (!isAdminRequest(req)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  const [[userCount], [linkCount], [loginCount]] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM app_users'),
    db.query('SELECT COUNT(*)::int AS count FROM links'),
    db.query('SELECT COALESCE(SUM(login_count), 0)::int AS count FROM app_users'),
  ]);
  return { body: { users: userCount.count, links: linkCount.count, logins: loginCount.count } };
});
