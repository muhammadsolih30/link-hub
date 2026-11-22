import { runApi } from '../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body, getUser }) => {
  const user = await getUser(request);
  if (!user) return { status: 401, body: { error: 'Tizimga kiring.' } };
  if (request.method === 'GET') {
    const rows = await db.query('SELECT id, name, user_id, created_at FROM categories WHERE user_id = $1 ORDER BY created_at ASC', [user.id]);
    return { body: rows };
  }
  if (request.method === 'POST') {
    const name = String(body.name || '').trim();
    if (!name || name.length > 50) return { status: 400, body: { error: 'Kategoriya nomi 1–50 belgi bo\'lsin.' } };
    const [row] = await db.query('INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING id, name, user_id, created_at', [name, user.id]);
    return { status: 201, body: row };
  }
  return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
});
