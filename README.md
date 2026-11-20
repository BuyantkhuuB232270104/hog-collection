# Хог цуглуулах захиалга, хуваарийн веб систем

Дархан-Уул аймгийн хог хаягдал цуглуулах захиалга, хуваарийн веб систем.
F.CSA350 Программ хангамжийн инженерчлэлийн төсөл — Ч.Буянтхүү (B232270104).

Иргэн, ААН бүсийнхээ хуваарийг харж, нэмэлт цуглуулалтын хүсэлтийг дугаартайгаар илгээнэ.
Зохицуулагч хүсэлтийг шалгаж, гүйцэтгэгчид давхцалгүй хуваарилна. Гүйцэтгэгч гар утсаараа үр дүнг бүртгэнэ.
Удирдлага тайлан харж, CSV татна.

## ⚡ Хамгийн хурдан арга (Windows + VS Code)

1. Энэ хавтсыг `C:\hog-system` руу задална.
2. **`SETUP.bat`** дээр давхар дарна (Administrator зөвшөөрөл асууна → **Yes**).
   Node.js, PostgreSQL 16, VS Code-ийг winget-ээр суулгаж, `hog`, `hog_test` өгөгдлийн сан,
   `server\.env` үүсгээд жишээ өгөгдөл оруулж, VS Code-ийг нээнэ.
   npm модулиуд (`node_modules`, Windows x64 binary-тай) болон `client\dist` аль хэдийн бэлэн тул интернэтээс татахгүй.
3. VS Code дотор **Ctrl+Shift+B** → систем асна → http://localhost:3000
   (эсвэл **F5** — debug горимоор асааж хөтөч автоматаар нээгдэнэ; эсвэл `START.bat`).

VS Code-ийн **Terminal → Run Task** цэсэнд: систем асаах, жишээ өгөгдөл шинээр оруулах, тест ажиллуулах, build, dev горим.
SQLTools өргөтгөл суулгавал «hog (localhost)» холболтоор хүснэгтүүдийг шууд харна.

| Үүрэг | Нэвтрэх | Нууц үг |
|---|---|---|
| Иргэн | 99000001 | Demo12345 |
| Зохицуулагч | 90000002 | Demo12345 |
| Жолооч | 90000003 | Demo12345 |
| Удирдлага | 90000005 | Demo12345 |
| Админ | 90000001 | Demo12345 |

Дипломын баримт: `docs/Buyantkhuu_B232270104_Diplom_v5.pdf`. Ачааллын шалгалт: `node scripts/load-test.js`.

## Технологи

| Давхарга | Технологи |
|---|---|
| Front end | React 19, React Router 7, Vite 7 (responsive SPA) |
| Back end | Node.js 20+, Express 4, Zod (оролтын шалгалт), Helmet, express-rate-limit |
| Өгөгдлийн сан | PostgreSQL 14+ (`btree_gist` өргөтгөлтэй), 14 хүснэгт |
| Аюулгүй байдал | Argon2id нууц үг (m=19 MiB, t=2, p=1), JWT HttpOnly cookie, үүрэгт суурилсан эрх |
| Тест | node:test + Supertest (16 интеграцийн тест), Playwright (дэлгэцийн шалгалт) |

## Бүтэц

```
hog-system/
├─ server/                 Express REST API
│  ├─ db/schema.sql        Өгөгдлийн сангийн схем (хязгаарлалт, trigger)
│  ├─ src/routes/          API зам, Zod схем
│  ├─ src/services/        Бизнес логик (UC-01 … UC-07)
│  ├─ src/middleware/      Нэвтрэлт, эрх, шалгалт
│  ├─ src/db/              Холболт, init, seed
│  └─ tests/api.test.js    TC-01 … TC-17
├─ client/                 React SPA
│  └─ src/pages/           Үүрэг бүрийн хуудас
├─ scripts/                Нөөцлөх, сэргээх скрипт
└─ docs/screens/           Дэлгэцийн зургууд
```

## Суулгах, ажиллуулах

**Шаардлага:** Node.js 20+, PostgreSQL 14+.

1. Өгөгдлийн сан үүсгэнэ (psql, superuser-ээр):
   ```sql
   CREATE ROLE hog LOGIN PASSWORD 'нууц-үг';
   CREATE DATABASE hog OWNER hog;
   \c hog
   CREATE EXTENSION btree_gist;
   ALTER SCHEMA public OWNER TO hog;
   ```
2. Тохиргоо хийнэ: `server/.env.example`-ийг `server/.env` болгож хуулаад, `DATABASE_URL`, `JWT_SECRET`-ийг өөрчилнө.
3. Хамаарлыг суулгаж, build хийнэ:
   ```bash
   npm run install:all
   npm run build
   ```
4. Схем, жишээ өгөгдөл оруулна. **Анхааруулга:** энэ алхам өмнөх өгөгдлийг устгана.
   ```bash
   npm run db:seed
   ```
5. Ажиллуулна:
   ```bash
   npm start
   ```
   Дараа нь http://localhost:3000 хаягаар нээнэ.

Хөгжүүлэлтийн үед:
- `npm run dev:server` — API-г :3000 дээр ажиллуулна.
- `npm run dev:client` — Vite-ийг :5173 дээр ажиллуулна. `/api` хүсэлтүүд :3000 руу дамжина.

## Жишээ хэрэглэгчид (зөвхөн хөгжүүлэлтэд)

Бүх нэр, хаяг, утас зохиомол. Бүх хэрэглэгчийн нууц үг: `Demo12345`.

| Үүрэг | Нэвтрэх |
|---|---|
| Иргэн | 99000001 |
| ААН-ийн төлөөлөгч (баталгаажаагүй) | 99000002 |
| Зохицуулагч | 90000002 |
| Гүйцэтгэгч (жолооч) | 90000003, 90000004 |
| Удирдлага | 90000005 |
| Админ | 90000001 |

## Тест

Тестийг тусдаа `hog_test` өгөгдлийн сан дээр ажиллуулна. Тест бүр уг санг дахин үүсгэдэг.

```bash
DATABASE_URL=postgres://hog:нууц-үг@localhost:5432/hog_test npm test
```

Нөөцөөс сэргээх шалгалт (TC-15):

```bash
SRC_URL=postgres://.../hog DST_URL=postgres://.../hog_restore scripts/restore-check.sh
```

## Шаардлага ба кодын уялдаа

| Баримт | Код |
|---|---|
| UC-01 Бүртгэл удирдах | `services/auth.js`, `services/admin.js`, `pages/Register.jsx`, `pages/Admin*.jsx` |
| UC-02 Хуваарь удирдах | `services/schedules.js`, `pages/Schedule.jsx`, `pages/CoordSchedule.jsx` |
| UC-03 Хүсэлт удирдах | `services/requests.js`, `pages/NewRequest.jsx`, `pages/MyRequests.jsx`, `pages/RequestDetail.jsx` |
| UC-04 Гомдол, мэдэгдэл | `services/complaints.js`, `pages/Complaints.jsx`, `pages/Notifications.jsx` |
| UC-05 Ажил хуваарилалт | `services/jobs.js` (`assign`, `change`), `pages/CoordRequests.jsx`, `pages/CoordJobs.jsx` |
| UC-06 Гүйцэтгэл | `services/jobs.js` (`today`, `record`), `pages/DriverToday.jsx` |
| UC-07 Тайлан | `services/reports.js`, `pages/Reports.jsx` |
| BR-05 давхцал | `jobs_no_overlap` exclusion constraint + `findOverlap()` |
| BR-08 түүх засахгүй | `trg_history_readonly` trigger |
| BR-09 давхар илгээлт | `Idempotency-Key` толгой + `requests.idempotency_key UNIQUE` |
| NFR-10 нууцлал | `reports.js` — тайланд нэр, утас, хаяг гаргахгүй |

## Анхаарах зүйлс

- **Жишээ өгөгдөл.** Хаягийн лавлах, бүс, хуваарь бүгд жишээ. Бодит ашиглалтад хог тээврийн байгууллагаас авсан батлагдсан хуваарь, хаягийн лавлахыг админы «Лавлах» хэсгээр оруулна.
- **Мэдэгдэл.** Мэдэгдэл зөвхөн систем дотор харагдана. SMS, push мэдэгдэл байхгүй (v2).
- **Production.**
  - `NODE_ENV=production`, урт санамсаргүй `JWT_SECRET` тохируулна.
  - HTTPS-ийн ард (nginx гэх мэт) ажиллуулна.
  - `scripts/backup.sh`-ийг cron-д өдөр бүр ажиллахаар тохируулна.

## Өгөгдлийн сан (DB) харах

PostgreSQL 16 · сан: `hog` · хэрэглэгч: `hog` · нууц үг: `hog123` · хост: `localhost:5432`

**1. pgAdmin 4 (хамгийн хялбар)** — Start цэснээс «pgAdmin 4» нээгээд Servers → Register → Server:
Host `localhost`, Port `5432`, Database `hog`, Username `hog`, Password `hog123`.
Дараа нь `hog → Schemas → public → Tables` дээр хулганы баруун товч → *View/Edit Data → All Rows*.

**2. psql (командын мөр)**
```
psql -h localhost -U hog -d hog
\dt                          -- хүснэгтүүд
SELECT request_no, status FROM requests ORDER BY id DESC LIMIT 10;
SELECT at, action, detail FROM audit_log ORDER BY id DESC LIMIT 20;
\q
```

**3. VS Code** — «PostgreSQL» (Chris Kolkman) өргөтгөл суулгаад дээрх холболтыг нэмнэ.

Гол хүснэгтүүд: `users`, `user_roles`, `requests`, `jobs`, `status_history`, `complaints`, `notifications`, `audit_log`, `schema_migrations`.

## Шинэчлэлт хийсний дараа
Серверийг дахин асаахад (`npm start`) шинэ migration автоматаар ажиллаж, одоо байгаа өгөгдөл устахгүй.
Анхаар: `npm run db:seed` бүх өгөгдлийг устгаад демо өгөгдлөөр дүүргэнэ.
