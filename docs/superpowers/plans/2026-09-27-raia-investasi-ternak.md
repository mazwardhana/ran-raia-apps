# Raia Investasi Ternak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun PWA platform investasi ternak Raia untuk pitching investor, dengan landing SEO, alur investor lengkap, dashboard operator, seed data realistis, import ternak, Midtrans Sandbox, dan deployment Docker self-hosted.

**Architecture:** Next.js 14 App Router + TypeScript + Mantine v7 dalam satu codebase. PostgreSQL dan MinIO berjalan di Docker Compose, Prisma menjadi ORM, NextAuth menangani sesi, dan Midtrans Snap Sandbox menangani checkout. Route groups `(public)`, `(app)`, dan `(operator)` memakai layout yang berbeda.

**Tech Stack:** Next.js 14, Mantine v7, Prisma 5, PostgreSQL 16, NextAuth v5, MinIO, Midtrans Snap, Recharts, React Hook Form, Zod, Docker Compose, Nginx.

**Spec:** `docs/superpowers/specs/2026-09-27-raia-investasi-ternak-design.md`

## Global Constraints

- UI memakai Bahasa Indonesia.
- Minimum checkout `50000`, harga lot default `10000`, minimum 5 lot/transaksi.
- Profit split default Raia `60%`, investor `40%`, disimpan di `settings`.
- Ta'awun tahun pertama `300000`, tahun berikutnya `150000`, perlindungan 100%.
- Secondary market memakai harga par flat, expiry `7` hari, takeover Raia 100%, fee default `0`.
- Satu Site Project memiliki satu entitas PT legal yang berbeda.
- Semua form/detail data dibuka dalam modal responsive; mobile full-width slide-up.
- Dropdown dengan lebih dari 5 pilihan memiliki search/autocomplete.
- Semua tabel memiliki search, filter, sort, pagination 10/25/50.
- Semua data view memiliki loading, empty, error, dan success state bila relevan.
- Semua akun memiliki username unik, case-insensitive.
- Mobile viewport 360px tidak boleh horizontal overflow; touch target minimal 44px.
- Secret hanya dari `.env`; `.env` tidak boleh di-commit.
- Password demo seed: `password123`.
- Antislop diterapkan selama pengerjaan (mode DURING).
- Repository target: `https://github.com/mazwardhana/ran-raia-apps.git`.

## Review Focus

1. Lot di bawah Rp50.000 ditolak dengan pesan jelas. Test: `checkout rejects lot subtotal below min checkout`.
2. Checkout concurrent tidak oversell slot. Test: `package slot decrement is atomic`.
3. Listing expired tepat pada `listed_at + 7 days` dan takeover bernilai par 100%. Test: `stale listing becomes takeover at par`.
4. Profit split dan pembulatan tidak kehilangan rupiah. Test: `profit split sums exactly to gross`.
5. CSV campuran valid/invalid mengimpor baris valid dan melaporkan error per baris. Test: `mixed import reports invalid rows`.
6. KYC pending tidak dapat checkout. Test: `pending KYC cannot checkout`.
7. Callback Midtrans invalid tidak mengubah order menjadi PAID. Test: `invalid callback signature is rejected`.

---

### Task 1: Foundation

**Files:** `package.json`, `next.config.mjs`, `tsconfig.json`, `.env.example`, `.gitignore`, `Dockerfile`, `docker-compose.yml`, `src/app/layout.tsx`, `src/app/globals.css`, `src/theme/theme.ts`, `src/lib/prisma.ts`.

**Produces:** scripts `dev/build/start/lint/test`, Mantine provider/theme, Prisma singleton, Docker services `nginx`, `nextjs`, `postgres`, `minio` dalam network `ran-network`.

- [ ] Scaffold Next.js 14 App Router TypeScript dan install Mantine, Prisma, NextAuth, Recharts, RHF, Zod, Day.js, Vitest/testing-library.
- [ ] Implement root Mantine layout, metadata `Raia - Investasi Ternak`, theme primary green dengan radius/shadow konsisten.
- [ ] Implement Docker Compose dengan Postgres 16, MinIO, volumes persistent, env placeholders, dan Dockerfile multi-stage non-root.
- [ ] Buat `.env.example` untuk database, auth, Midtrans Sandbox, MinIO; pastikan `.env` di-ignore.
- [ ] Verifikasi `npm run build` dan `docker compose config`; commit `feat: scaffold app and docker foundation`.

### Task 2: Database, Business Calculations, Seed

**Files:** `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/seed-data/*`, `src/lib/calculations.ts`, `src/tests/calculations.test.ts`.

**Produces:** models User, UserProfile, SiteProject, Package, PackageCost, Transaction, LotOwnership, FullOwnership, Livestock, LivestockEvent, MilkLog, ProfitDistribution, InvestorBalance, Withdrawal, TaawunClaim, SecondaryListing, SecondarySale, Article, Notification, Setting. Enum status/role sesuai spec.

- [ ] Tulis test lebih dulu untuk `calcProfitSplit`, `calcInvestorShare`, `calcLotOrder`, `calcListingExpiry`; jalankan dan pastikan gagal.
- [ ] Implement fungsi murni dengan pembulatan yang jumlahnya tetap sama dengan gross; jalankan test sampai pass.
- [ ] Buat schema, indexes, unique username/legal entity, relasi ownership/package/site, lalu migration `init`.
- [ ] Buat seed: 10 site tersebar Jawa, Kalimantan, NTT, NTB, Sulawesi; kapasitas masing-masing 2500-3000; PT legal berbeda.
- [ ] Seed 10 paket `RUNNING`, 10 paket `OPEN`, 20 user (1 admin, 2 operator, 17 investor), 7 artikel, settings default.
- [ ] Seed ownership utuh/lot bervariasi, transaksi, profit, balance, ternak, milk logs, events, dan listing secondary.
- [ ] Verifikasi `prisma db seed` dan query count 10 sites, 20 packages, 20 users, 7 articles; commit `feat: database schema and demo seed data`.

### Task 3: Auth, Roles, Route Protection

**Files:** `src/lib/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/register/route.ts`, `src/tests/auth.test.ts`.

**Produces:** credentials login via email/username, JWT session dengan id/role/username/kycStatus, `getCurrentUser()`, `requireRole()`, route protection.

- [ ] Test registrasi username unik, duplicate case-insensitive, unauthenticated redirect, KYC pending checkout redirect; pastikan fail.
- [ ] Implement bcrypt credential provider dan register API dengan Zod username `^[a-z0-9_]{3,30}$`, email unik, password min 8.
- [ ] Implement middleware: `/app` login, `/op` OPERATOR/ADMIN, `/kyc` login, `/app/checkout` memerlukan VERIFIED.
- [ ] Jalankan test dan build; commit `feat: auth and route protection`.

### Task 4: UI Kit

**Files:** `src/components/ui/{BaseModal,DataTable,SearchableSelect,MetricCard,ChartCard,EmptyState,LoadingState,ErrorState,StatusBadge}.tsx`, `src/hooks/usePaginatedQuery.ts`, `src/tests/ui-components.test.tsx`.

**Produces:** BaseModal responsive/Escape/scroll lock, DataTable search/filter/sort/pagination, SearchableSelect debounce 300ms, metric/chart/state components.

- [ ] Tulis test modal Escape, table controls, select filtering, empty/loading states; pastikan fail.
- [ ] Implement dengan Mantine, keyboard focus, tap target 44px, no horizontal overflow.
- [ ] Jalankan test dan commit `feat: reusable responsive ui kit`.

### Task 5: Public Landing, Articles, SEO

**Files:** `src/app/(public)/layout.tsx`, `page.tsx`, `artikel/page.tsx`, `artikel/[slug]/page.tsx`, `paket/page.tsx`, `src/components/landing/*`, `src/lib/seo.ts`, `src/tests/landing.test.tsx`.

- [ ] Test hero CTA/navigation, 7 article titles, slug detail, metadata title/description; pastikan fail.
- [ ] Implement landing informatif: hero, value proposition, paket unggulan, cara kerja, transparansi, ta'awun, secondary market, artikel, FAQ spesifik, CTA, footer.
- [ ] Gunakan data demo yang diberi label; jangan tampilkan klaim statistik/testimoni nyata tanpa sumber.
- [ ] Implement artikel SEO dengan metadata, OG, canonical, JSON-LD Article, dan katalog publik.
- [ ] Test + keyboard/contrast review; commit `feat: seo landing and articles`.

### Task 6: Investor Registration, Login, KYC Demo

**Files:** `src/app/(public)/login/page.tsx`, `register/page.tsx`, `src/app/kyc/page.tsx`, `src/app/api/kyc/route.ts`, `src/tests/kyc.test.tsx`.

- [ ] Test register validation, login email/username, auto-fill demo, verification 3 detik; pastikan fail.
- [ ] Implement form modal/feedback, template KYC, progress `Sedang diverifikasi...`, update PENDING ke VERIFIED, redirect dashboard.
- [ ] Test pass; commit `feat: investor onboarding and demo kyc`.

### Task 7: Investor PWA Core

**Files:** `src/app/(app)/layout.tsx`, `page.tsx`, `paket/page.tsx`, `paket/[id]/page.tsx`, `src/components/shared/*`, `src/components/investor/*`, `src/app/api/packages/*`, `src/tests/investor.test.tsx`.

- [ ] Test bottom nav routes, dashboard metrics/charts, package filter, detail cost breakdown; pastikan fail.
- [ ] Implement mobile layout bottom nav 5 item: Dashboard, Paket, Portofolio, Secondary, Profil.
- [ ] Implement dashboard metrics, Pie portfolio, Line profit, activity feed, KYC banner.
- [ ] Implement package API/filter/search and detail with site legal entity, costs, progress, return, gallery.
- [ ] Test pass dan viewport 360px; commit `feat: investor dashboard and package catalog`.

### Task 8: Checkout and Midtrans Sandbox

**Files:** `src/app/(app)/checkout/[id]/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/api/payments/midtrans/{route,callback/route}.ts`, `src/lib/midtrans.ts`, `src/tests/checkout.test.ts`.

- [ ] Test min checkout, KYC, atomic slot decrement, valid/invalid callback, expired order; pastikan fail.
- [ ] Implement `POST /api/checkout {packageId, ownershipType, lotCount?}` dengan Prisma transaction, KYC VERIFIED, package OPEN, subtotal >= 50000, slot atomic.
- [ ] Implement Midtrans Snap Sandbox dari env dan callback signature SHA512; hanya settlement/capture menjadi PAID.
- [ ] Implement checkout UI dengan ringkasan, lot quantity, fee, payment action.
- [ ] Test pass; commit `feat: sandbox checkout flow`.

### Task 9: Portfolio, Transactions, Withdrawal, Profile

**Files:** `src/app/(app)/portofolio/*`, `penarikan/page.tsx`, `profil/page.tsx`, `transaksi/page.tsx`, `src/app/api/portfolio/route.ts`, `withdrawals/route.ts`, `profile/route.ts`, `src/tests/portfolio.test.tsx`.

- [ ] Test ownership utuh/lot, withdrawal min 50000 and balance, unique username; pastikan fail.
- [ ] Implement portfolio detail timeline/event/milk chart/profit report, transaction table filters.
- [ ] Implement withdrawal request dan profile username update melalui modal.
- [ ] Test pass; commit `feat: portfolio withdrawal and profile`.

### Task 10: Secondary Market

**Files:** `src/app/(app)/secondary/page.tsx`, `src/app/(operator)/secondary/page.tsx`, `src/app/api/secondary/route.ts`, `src/lib/secondary.ts`, `src/tests/secondary.test.ts`.

- [ ] Test par listing, ownership transfer, expiry 7 hari, takeover 100%, fee 0/flat; pastikan fail.
- [ ] Implement `GET /api/secondary`, `POST /api/secondary/list`, `POST /api/secondary/buy`, dan `expireStaleListings()`.
- [ ] Implement investor list/sell/buy dan operator monitoring table dengan filters.
- [ ] Test pass; commit `feat: flat-price secondary market`.

### Task 11: PWA Packaging

**Files:** `public/manifest.json`, `public/icons/*`, `next.config.mjs`, `src/app/offline/page.tsx`, `src/tests/pwa.test.tsx`.

- [ ] Test manifest name/icons/standalone dan service worker; pastikan fail.
- [ ] Implement manifest, icons placeholder yang jujur bila logo final belum tersedia, next-pwa cache static assets/network-first API, offline page.
- [ ] Test/build pass; commit `feat: installable pwa and offline fallback`.

### Task 12: Operator Dashboard, Site, Package CRUD

**Files:** `src/app/(operator)/layout.tsx`, `page.tsx`, `site-projects/page.tsx`, `paket/page.tsx`, `src/components/operator/*`, `src/app/api/admin/site-projects/route.ts`, `packages/route.ts`, `src/tests/operator.test.tsx`.

- [ ] Test sidebar routes, site modal save/filter, package lot calculation, PT duplicate rejection; pastikan fail.
- [ ] Implement operator layout/sidebar responsive dan overview charts/metrics.
- [ ] Implement Site Project CRUD dengan modal, searchable selects, legal fields, capacity, filters.
- [ ] Implement Package CRUD modal bertab: info, ternak, biaya, return, media, jadwal; total lots auto-calc.
- [ ] Test pass; commit `feat: operator site and package management`.

### Task 13: Livestock Import, Profit, Ta'awun, Settings

**Files:** `src/app/(operator)/ternak/page.tsx`, `profit/page.tsx`, `taawun/page.tsx`, `settings/page.tsx`, `src/app/api/admin/livestock/*`, `profit/route.ts`, `taawun/route.ts`, `settings/route.ts`, `src/lib/import-livestock.ts`, `src/tests/import-livestock.test.ts`.

- [ ] Test template columns, mixed CSV valid/invalid rows, duplicate tag, date/type error, 1000-row cap; pastikan fail.
- [ ] Implement download template CSV, upload/parse CSV, preview per-row validation, import valid rows, error report; gunakan modal dan dropzone.
- [ ] Implement operator charts/data ternak, manual event/milk input, profit calculation/distribution 60/40, ta'awun claim 100%, configurable settings.
- [ ] Test pass; commit `feat: livestock import operations and settings`.

### Task 14: Notifications, Hardening, Verification, Deployment

**Files:** `src/app/(app)/notifikasi/page.tsx`, `src/app/api/notifications/route.ts`, `src/lib/validation.ts`, `nginx/nginx.conf`, `README.md`, `.github/workflows/ci.yml`.

- [ ] Implement notification bell/feed untuk payment, KYC, profit, listing, claim.
- [ ] Add server validation, error boundaries, loading/empty/error states pada route utama, upload type/size limits, role checks.
- [ ] Add Nginx reverse proxy for `ran.teknoloka.id`, HTTP to HTTPS notes, Docker production instructions.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, `docker compose config`, and smoke test seeded app on mobile/desktop.
- [ ] Inspect all interactive controls: navigation, modal Escape, select search, filters, forms, KYC, checkout sandbox, listing, import.
- [ ] Commit `chore: harden verify and document deployment`.

### Final Repository Push

- [ ] Review `git status`, ensure no `.env`, secrets, build output, or database volumes are tracked.
- [ ] Add remote `origin` to `https://github.com/mazwardhana/ran-raia-apps.git`.
- [ ] Push `main` only after fresh verification evidence and user authorization to publish.
- [ ] Record commit SHA, deployed URL target, demo accounts, seed command, and verification output in final report.
