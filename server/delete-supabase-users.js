import 'dotenv/config';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY server .env faylida kerak.');
if (process.env.CONFIRM_DELETE_ALL_SUPABASE_USERS !== 'YES') {
  throw new Error('Ommaviy o\'chirish to\'xtatildi. Faqat aniq tasdiq bilan ishga tushiring: CONFIRM_DELETE_ALL_SUPABASE_USERS=YES npm run clear:supabase-users');
}

const base = url.replace(/\/$/, '');
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
let deleted = 0;
for (;;) {
  const response = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=100`, { headers });
  if (!response.ok) throw new Error(`Supabase foydalanuvchilarini olishda xato (${response.status}).`);
  const payload = await response.json();
  const batch = payload.users || payload;
  if (!Array.isArray(batch)) throw new Error('Supabase admin API kutilmagan javob qaytardi.');
  if (batch.length === 0) break;
  for (const user of batch) {
    const result = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers });
    if (!result.ok) throw new Error(`Akkaunt o\'chmadi (${result.status}); jarayon to\'xtatildi.`);
    deleted += 1;
  }
}
console.log(`${deleted} ta Supabase akkaunti o'chirildi.`);
