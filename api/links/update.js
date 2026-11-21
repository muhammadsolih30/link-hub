import { runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body, getUser }) => {
  const user = await getUser(request);
  if (!user) return { status: 401, body: { error: 'Tizimga kiring.' } };
  if (request.method !== 'PUT') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const url = body.url;
  if (!title || title.length > 100) return { status: 400, body: { error: 'Link nomi 1–100 belgi bo\'lsin.' } };
  try { new URL(url); } catch { return { status: 400, body: { error: 'To\'g\'ri URL manzil kiriting.' } }; }
  const categoryId = body.category_id || null;
  if (categoryId) {
    const [category] = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [categoryId, user.id]);
    if (!category) return { status: 400, body: { error: 'Kategoriya topilmadi.' } };
  }
  const [row] = await db.query('UPDATE links SET title = $1, url = $2, category_id = $3, updated_at = now() WHERE id = $4 AND user_id = $5 RETURNING id', [title, url, categoryId, body.id, user.id]);
  return row ? { body: { ok: true } } : { status: 404, body: { error: 'Link topilmadi.' } };
});
