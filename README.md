# Link Hub

Frontend Vite/React, Node.js/Express backend va Neon PostgreSQL bilan ishlaydi.

## Birinchi sozlash

Lokal `.env` faylida `VITE_DEMO_MODE=true` bo'lsa, demo login, linklar va admin panel ma'lumotlari shu brauzerning `localStorage` omborida saqlanadi. Admin sahifasi `/admin`, kirish kodi `muhammadsolih1027`. Bu kod faqat lokal demo uchun: frontend ichida bo'lgani sababli production uchun maxfiy himoya hisoblanmaydi. Vercel deployida `VITE_DEMO_MODE=false` bo'lsa, admin `ADMIN_API_KEY` orqali server tomonda tekshiriladi va API Neon'dan ma'lumot oladi.

1. Mavjud `.env` faylini ustidan yozmang; `.env.example` dagi kerakli qiymatlarni unga qo‘shing.
2. Neon Console’dan connection string oling va `DATABASE_URL` qiymatiga qo‘ying. `JWT_SECRET` uchun uzun, tasodifiy maxfiy qiymat tanlang.
3. Paketlarni o‘rnating: `npm install`.
4. Backend va frontendni alohida terminallarda ishga tushiring: `npm run server` va `npm run dev`.
5. Sayt `http://localhost:8080` manzilida ochiladi. Backend birinchi ishga tushganda kerakli jadvallarni Neon’da yaratadi.

Parollar bcrypt bilan hash qilinadi. Akkaunt, link va kategoriyalar Neon’da saqlanadi; API link/kategoriya so‘rovlarini akkaunt egasi bilan cheklaydi.

## Eski Supabase akkauntlarini o‘chirish

Yangi backend Neon’dagi alohida `app_users` jadvalini ishlatadi. Eski Supabase akkauntlarını silamoqchi bo‘lsangiz, `.env` ga `SUPABASE_URL` va serverda saqlanadigan `SUPABASE_SERVICE_ROLE_KEY` qo‘shing. Keyin aniq tasdiq bilan `CONFIRM_DELETE_ALL_SUPABASE_USERS=YES npm run clear:supabase-users` buyrug‘ini bajaring. Bu amalni qaytarib bo‘lmaydi.

## Vercel va Neon

Vercel'dagi loyiha sozlamalarining Environment Variables bo'limiga `DATABASE_URL` (Neon connection string), `JWT_SECRET`, `ADMIN_API_KEY` (bir-biridan farqli, uzun tasodifiy maxfiy qiymatlar), `APP_URL` (saytning to'liq URL'i) va `VITE_DEMO_MODE=false` qo'shing. `DATABASE_URL`, `JWT_SECRET` va `ADMIN_API_KEY` server o'zgaruvchilari bo'lib qoladi, ularni `VITE_` bilan boshlamang. Keyin Production deploymentni qayta yarating. `api/` ichidagi Node.js funksiyalar Vercel'da `/api/...` manzillarida ishlaydi va jadvallarni Neon'da birinchi so'rovda yaratadi.

`/admin` sahifasida `ADMIN_API_KEY` so'raladi. Panel foydalanuvchilar soni, loginlar, ro'yxatdan o'tgan vaqt, email, telefon va saqlangan linklarni ko'rsatadi. Parollarni ko'rsatmaydi; Neon backend rejimida 30 daqiqalik bir martalik parol tiklash havolasini yaratadi. Admin ko'rish va reset amallari `admin_audit` jadvalida qayd etiladi.

Foydalanuvchi paneldagi profil menyusidan parolini eski paroli bilan yangilashi mumkin. Kirish sahifasidagi `Parol esimdan chiqdi` bo'limida email, ism va telefon orqali yordam so'rovi yuboriladi. Admin panel so'rovlarni avtomatik yangilab turadi va akkauntdagi email hamda telefon bilan solishtiradi. Ma'lumotlar mos bo'lsa admin 30 daqiqalik bir martalik kod chiqaradi; foydalanuvchi email va telefonini tiklash sahifasiga kiritib kutadi, kod shu sahifada avtomatik paydo bo'ladi. Kod tasdiqlangach yangi parol o'rnatish oynasi ochiladi.

GitHub repository Vercel projectga bog'langan bo'lsa, Production branch'ga push qilingan o'zgarishlar yangi deploy yaratadi. `.env` faylini GitHub'ga qo'shmang.
