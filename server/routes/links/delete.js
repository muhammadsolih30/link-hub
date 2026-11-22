import { runApi } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body, getUser }) => {
  const user = await getUser(request);
  if (!user) return { status: 401, body: { error: 'Tizimga kiring.' } };
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  await db.query('DELETE FROM links WHERE id = $1 AND user_id = $2', [body.id, user.id]);
  return { status: 204 };
});
