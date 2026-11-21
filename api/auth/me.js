import { runApi, publicUser } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ getUser }) => {
  const user = await getUser(req);
  return user ? { body: { user: publicUser(user) } } : { status: 401, body: { error: 'Tizimga qayta kiring.' } };
});
