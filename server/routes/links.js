import { runApi } from '../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body, getUser }) => {
  const user = await getUser(request);
  if (!user) return { status: 401, body: { error: 'Tizimga kiring.' } };
  if (request.method === 'GET') {
    const rows = await db.query('SELECT id, title, url, category_id, user_id, created_at, updated_at FROM links WHERE user_id = $1 ORDER BY created_at DESC', [user.id]);
    return { body: rows };
  }
  if (request.method === 'POST') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const url = body.url;
    if (!title || title.length > 100) return { status: 400, body: { error: 'Link nomi 1–100 belgi bo\'lsin.' } };
    try { new URL(url); } catch { return { status: 400, body: { error: 'To\'g\'ri URL manzil kiriting.' } }; }
    const categoryId = body.category_id || null;
    if (categoryId) {
      const [category] = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [categoryId, user.id]);
      if (!category) return { status: 400, body: { error: 'Kategoriya topilmadi.' } };
    }
    const [row] = await db.query('INSERT INTO links (title, url, category_id, user_id) VALUES ($1, $2, $3, $4) RETURNING id, title, url, category_id, user_id, created_at, updated_at', [title, url, categoryId, user.id]);
    return { status: 201, body: row };
  }
  return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
});
