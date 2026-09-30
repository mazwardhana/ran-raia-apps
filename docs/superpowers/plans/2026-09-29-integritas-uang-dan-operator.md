# Integritas Uang & Alat Operator — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup empat kebocoran uang (P1–P4) dan menyediakan alat operator yang diperlukan, sehingga setiap pergerakan uang selalu berpasangan dengan baris ledger dan setiap perubahan status bersifat atomik.

**Architecture:** `Transaction` menjadi satu-satunya ledger dengan `orderId @unique` sebagai kunci idempotensi. Pembayaran secondary melewati Midtrans: listing dikunci `PENDING_PAYMENT` lebih dulu, aset berpindah **hanya** saat settlement. Penarikan dana dikunci saat pengajuan. Takeover memindahkan aset ke akun treasury Raia.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL, Midtrans Snap (`MIDTRANS_MODE` tidak di-set = mode nyata), Mantine v7, vitest.

**Spec:** Tidak ada dokumen spec terpisah — keputusan disepakati dalam percakapan dan dirangkum di "Global Constraints" + tiap task. Ruling tercatat di ledger SDD.

## Global Constraints

- Helper otorisasi sudah ada: `requireRole(role | role[])` di `src/lib/auth.ts` (melempar `AuthenticationError`). Semua guard baru memakai itu — **jangan** menulis guard manual baru.
- Prisma **boleh** disentuh (izin pemilik: larangan "jangan sentuh Prisma" dicabut). Migrasi harus additive: `ALTER TABLE` / `ALTER TYPE` / `CREATE INDEX`; **tanpa** `DROP COLUMN`, `TRUNCATE`, `DELETE`.
- Jangan mengubah mekanisme verifikasi tanda tangan Midtrans (`sha512(order_id + status_code + gross_amount + SERVER_KEY)`) — sudah terbukti lulus E2E hidup.
- Jangan mengubah `src/lib/reservations.ts` (`releaseReservation`, `expireStaleTransactions`, `calcLotRange`) kecuali disebut eksplisit.
- Semua copy user-facing berbahasa Indonesia.
- Tanpa `git add -A` / `git add .` / `git commit -a`. Stage per nama berkas. Dilarang `git checkout`, `git stash`, `git reset`, `git clean`, `git rebase`.
- Gates wajib lulus sebelum tiap task dinyatakan selesai: `npx tsc --noEmit` (exit 0), `npm run lint` (bersih), `npx vitest run`. Baseline saat ini: **203/203 di 24 berkas**.
- TDD wajib: tulis tes gagal dulu, jalankan, lihat gagal karena alasan yang benar, baru implementasi minimal.
- Transisi status wajib `updateMany({ where: { id, status: <lama> } })` — jangan `update({ where: { id } })` untuk status.
- `Transaction.orderId @unique` = kunci idempotensi; satu operasi keuangan = satu `$transaction` berisi ledger + perubahan saldo.
- Target DB: `docker exec -i ran-postgres psql -U raia -d raia`.
- Akun demo (password `password123`): `admin_raia` (ADMIN), `operator_wilayah_1/_2` (OPERATOR), `budi_santoso`, `andi_wijaya` (INVESTOR).
- Deployment: `bash deploy/deploy.sh` (migrasi + build + health check, rollback otomatis bila health gagal).

## Review Focus

- Pembeli secondary **tidak pernah** boleh memegang aset sebelum settlement tiba.
- Batal/deny/expire harus mengembalikan listing ke `ACTIVE` **tanpa** menyentuh kepemilikan.
- Kredit laba harus idempoten: `markPaid` dua kali tidak boleh menggandakan saldo.
- Penarikan ganda melebihi saldo tidak boleh memotong `availableBalance` dua kali.
- Takeover tidak boleh meninggalkan kepemilikan di penjual.

---

### Task 1: Migrasi skema — pembayaran secondary, role sistem, audit penarikan

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_money_ledger_fields/migration.sql`

**Interfaces:**
- Produces: `ListingStatus.PENDING_PAYMENT`, `TransactionType.SECONDARY_BUY`, `Role.SYSTEM`, `Transaction.secondaryListingId`, `SecondaryListing.transaction`, `Withdrawal.approvedAt`, `Withdrawal.approvedById`.

- [ ] **Step 1: Rekam baseline enum sebelum migrasi**

Run:
```bash
docker exec -i ran-postgres psql -U raia -d raia -c \
  "select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='ListingStatus' order by enumsortorder;"
```
Expected: `ACTIVE, SOLD, EXPIRED, TAKEOVER, CANCELLED` (tanpa `PENDING_PAYMENT`).

- [ ] **Step 2: Tambahkan enum dan field di `prisma/schema.prisma`**

- `enum ListingStatus` → `PENDING_PAYMENT` setelah `ACTIVE`.
- `enum TransactionType` → `SECONDARY_BUY` setelah `BUY`.
- `enum Role` → `SYSTEM` setelah `ADMIN`.
- `model Transaction` → setelah `snapToken`:
  ```prisma
  secondaryListingId String? @unique
  secondaryListing   SecondaryListing? @relation(fields: [secondaryListingId], references: [id], onDelete: SetNull)
  ```
- `model SecondaryListing` → `transaction Transaction?` dan sertakan di relasi yang ada.
- `model Withdrawal` → setelah `note`:
  ```prisma
  approvedAt   DateTime?
  approvedById String?
  ```

- [ ] **Step 3: Validasi**

Run: `npx prisma validate` → exit 0.

- [ ] **Step 4: Buat migrasi tanpa otomatis menerapkan**

Run: `npx prisma migrate dev --create-only --name money_ledger_fields` → satu direktori migrasi baru.

- [ ] **Step 5: Audit SQL**

Run: `cat prisma/migrations/<ts>_money_ledger_fields/migration.sql`
Expected **ada**: `ALTER TYPE ... ADD VALUE`, `ALTER TABLE ... ADD COLUMN`, bila perlu `CREATE UNIQUE INDEX`.
Expected **absen**: `DROP COLUMN`, `DROP TABLE`, `TRUNCATE`, `DELETE`, perubahan data apa pun. Jika ada → STOP, laporkan BLOCKED.

- [ ] **Step 6: Terapkan + verifikasi**

```bash
npx prisma migrate deploy
npx prisma migrate status
npx prisma generate
npx tsc --noEmit && npm run lint && npx vitest run
```
Expected: status up to date; tsc 0; lint bersih; **203/203**.

- [ ] **Step 7: Verifikasi kolom di DB live**

```bash
docker exec -i ran-postgres psql -U raia -d raia -tA -c \
  "select column_name from information_schema.columns where table_name='Transaction' and column_name='secondaryListingId';"
docker exec -i ran-postgres psql -U raia -d raia -tA -c \
  "select column_name from information_schema.columns where table_name='Withdrawal' and column_name='approvedById';"
```
Expected: `secondaryListingId`, lalu `approvedById`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/<ts>_money_ledger_fields/migration.sql
git commit -m "feat(db): migrasi ledger untuk pembayaran secondary, role sistem, audit penarikan"
```

---

### Task 2: Akun treasury Raia

**Files:**
- Create: `src/lib/treasury.ts`
- Modify: `prisma/seed.ts`
- Test: `src/tests/treasury.test.ts`

**Interfaces:**
- Produces: `TREASURY_USERNAME = 'raia_treasury'`, `ensureTreasuryUser(client)`.

- [ ] **Step 1: Tulis tes gagal**

```typescript
// src/tests/treasury.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { upsert: vi.fn() } } }));

describe('ensureTreasuryUser', () => {
  it('menetapkan username raia_treasury dan role SYSTEM', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { ensureTreasuryUser, TREASURY_USERNAME } = await import('@/lib/treasury');
    await ensureTreasuryUser(prisma as never);
    const args = vi.mocked(prisma.user.upsert).mock.calls[0][0];
    expect(TREASURY_USERNAME).toBe('raia_treasury');
    expect(args.where.username).toBe('raia_treasury');
    expect(args.create.role).toBe('SYSTEM');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/tests/treasury.test.ts` → FAIL "Cannot find module".

- [ ] **Step 3:** Implement `src/lib/treasury.ts` — `upsert` dengan `where: { username: TREASURY_USERNAME }`, `create: { username, email: 'treasury@raia.internal', name: 'Raia Treasury', passwordHash: <hash acak 64 hex>, role: 'SYSTEM' }`, `update: { role: 'SYSTEM' }`.

- [ ] **Step 4:** jalankan lagi → PASS.

- [ ] **Step 5:** Panggil `ensureTreasuryUser(prisma)` dari `prisma/seed.ts` setelah bagian Users. Jalankan `npx tsx prisma/seed.ts`, verifikasi:
```bash
docker exec -i ran-postgres psql -U raia -d raia -tA -c \
  "select username, role from \"User\" where username='raia_treasury';"
```
Expected: `raia_treasury|SYSTEM`.

- [ ] **Step 6: Gates → 204/204. Commit** `src/lib/treasury.ts`, `src/tests/treasury.test.ts`, `prisma/seed.ts`.

---

### Task 3: P1 — `POST /api/secondary/buy` mengunci listing, bukan memindahkan aset

**Files:**
- Modify: `src/app/api/secondary/buy/route.ts`
- Test: `src/tests/secondary-payment.test.ts`

**Interfaces:**
- Consumes: `ListingStatus.PENDING_PAYMENT`, `TransactionType.SECONDARY_BUY`, `Transaction.secondaryListingId`.
- Produces: `{ orderId, snapToken, redirectUrl, total, simulate: false }` (mode nyata) atau `{ orderId, snapToken: null, redirectUrl: '/app/bayar-simulasi/<orderId>', simulate: true }`. **Tidak ada** `secondarySale.create`, `lotOwnership.update`, `investorBalance.upsert`.

- [ ] **Step 1: Tulis tes gagal**

```typescript
// src/tests/secondary-payment.test.ts
it('mengunci listing dan tidak memindahkan kepemilikan saat bayar', async () => {
  const res = await POST(listingRequest());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.orderId).toBeTruthy();
  expect(prisma.secondaryListing.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'lst_1', status: 'ACTIVE' }, data: { status: 'PENDING_PAYMENT' } })
  );
  expect(prisma.lotOwnership.update).not.toHaveBeenCalled();
  expect(prisma.investorBalance.upsert).not.toHaveBeenCalled();
  expect(prisma.secondarySale.create).not.toHaveBeenCalled();
});

it('menolak saat listing sudah bukan ACTIVE', async () => {
  prisma.secondaryListing.updateMany.mockResolvedValue({ count: 0 });
  expect((await POST(listingRequest())).status).toBe(409);
});
```

- [ ] **Step 2:** `npx vitest run src/tests/secondary-payment.test.ts` → FAIL (route lama masih memindahkan kepemilikan).

- [ ] **Step 3:** Implement ulang `POST`. Urutan wajib:
  1. Guard: `getCurrentUser`, body `listingId`, `expireStaleListings()`, `findUnique`, `status !== 'ACTIVE'` → 400, `expiresAt <= now` → 400, seller === user → 400.
  2. Guard FULL tetap ada → 400 `"Anda sudah memiliki aset pada paket ini"`.
  3. `calculateFee()` → `adminFee`.
  4. Satu `$transaction`: `secondaryListing.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'PENDING_PAYMENT' } })` (count 0 → throw `LISTING_TAKEN`) → `transaction.create({ type: 'SECONDARY_BUY', status: 'PENDING', ... })` → `transaction.update({ where: { id }, data: { secondaryListingId } })`.
  5. Setelah transaksi: `createSnapToken` (ikuti pola persis `src/app/api/checkout/route.ts`) atau `simulate: true` bila `isSimulateMode()`.
  6. `createSnapToken` gagal → **502**, pesan `"Gagal membuat sesi pembayaran. Listing Anda masih aktif dan bisa dicoba lagi."`, listing tidak diubah.

  Hapus blok `lotOwnership.update`, `secondarySale.create`, `update → SOLD`, `investorBalance.upsert` — pindah ke Task 4.

- [ ] **Step 4:** jalankan → PASS.
- [ ] **Step 5: Gates + commit.**

---

### Task 4: P1 — Callback settlement menyelesaikan pembelian secondary

**Files:**
- Create: `src/lib/secondary-settlement.ts`
- Modify: `src/app/api/payments/midtrans/callback/route.ts`
- Test: `src/tests/secondary-settlement.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function completeSecondaryPurchase(tx, transactionId: string): Promise<void>
  export async function releaseSecondaryPending(tx, transactionId: string): Promise<void>
  ```
  `completeSecondaryPurchase`: transfer `LotOwnership` menurut `lotStart`/`lotEnd`, `secondarySale.create`, `secondaryListing.update → SOLD` + `soldAt`, `investorBalance.upsert` penjual (`sellerPayout = listingPrice - adminFee`), `transaction.update → PAID` + `paidAt` + `paymentChannel`.
  `releaseSecondaryPending`: `secondaryListing.updateMany({ where: { secondaryListingId, status: 'PENDING_PAYMENT' }, data: { status: 'ACTIVE' } })` + `transaction.update → CANCELLED`.

- [ ] **Step 1: Tulis tes gagal**

```typescript
it('settlement memindahkan baris lot yang cocok rentang dan mencredit penjual', async () => {
  await completeSecondaryPurchase(tx, 'trx_1');
  expect(tx.lotOwnership.findFirst).toHaveBeenCalledWith({
    where: { packageId: 'pkg_1', userId: 'seller_1', lotStart: 426, lotEnd: 430 },
  });
  expect(tx.lotOwnership.update).toHaveBeenCalledWith({ where: { id: 'own_seller_426' }, data: { userId: 'buyer_1' } });
  expect(tx.secondarySale.create).toHaveBeenCalled();
  expect(tx.investorBalance.upsert).toHaveBeenCalled();
  expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }));
});

it('release mengembalikan listing ke ACTIVE tanpa menyentuh kepemilikan', async () => {
  await releaseSecondaryPending(tx, 'trx_1');
  expect(tx.secondaryListing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { secondaryListingId: 'lst_1', status: 'PENDING_PAYMENT' }, data: { status: 'ACTIVE' } }));
  expect(tx.lotOwnership.update).not.toHaveBeenCalled();
  expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED' } }));
});
```

- [ ] **Step 2:** jalankan → FAIL (modul belum ada).

- [ ] **Step 3:** Implement. Ambil listing dari `transaction.secondaryListingId`; listing `null` → throw. `lotStart`/`lotEnd` null → throw. `findFirst` dengan **`lotStart` + `lotEnd`**; tidak ada → throw (jangan tandai PAID tanpa aset berpindah). Fee dari setting `secondary_admin_fee_*`: `feeFlat + floor(listingPrice * feePercent / 100)`.

- [ ] **Step 4: Integrasi ke callback** (`src/app/api/payments/midtrans/callback/route.ts`):
  - `shouldUpdateToPaid && status === 'PENDING'`: bila `type === 'SECONDARY_BUY'` dan `secondaryListingId` terisi → `completeSecondaryPurchase(tx, ...)` **dalam** `$transaction` yang sama (jangan pakai jalur primer yang cuma tandai PAID + buat baris saldo 0).
  - cabang `deny`/`cancel`/`expire`: `SECONDARY_BUY` → `releaseSecondaryPending`; selain itu tetap `releaseReservation`.

- [ ] **Step 5:** jalankan → PASS.
- [ ] **Step 6: Gates + commit.**

---

### Task 5: P1 — Sapuan listing terkunci kedaluwarsa

**Files:**
- Modify: `src/lib/secondary.ts`
- Test: `src/tests/secondary-expiry.test.ts`

**Interfaces:**
- Consumes: `releaseSecondaryPending`.
- Produces: `expireStaleListings` **melewati** `PENDING_PAYMENT`; `expireStalePendingPayments()` baru.

- [ ] **Step 1: Tulis tes gagal**

```typescript
it('mengabaikan listing PENDING_PAYMENT — sedang dibayar', async () => {
  prisma.secondaryListing.findMany.mockResolvedValue([
    { id: 'stale', status: 'ACTIVE', expiresAt: new Date(Date.now() - 1000) },
    { id: 'paying', status: 'PENDING_PAYMENT', expiresAt: new Date(Date.now() - 1000) },
  ]);
  await expireStaleListings();
  const ids = prisma.secondaryListing.update.mock.calls.map(c => c[0].where.id);
  expect(ids).toContain('stale');
  expect(ids).not.toContain('paying');
});
```
Tambah satu tes: transaksi `SECONDARY_BUY` `PENDING` `expiredAt < now` → `releaseSecondaryPending` terpanggil.

- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Tambahkan `status: 'ACTIVE'` ke `where` sapuan; tambah `expireStalePendingPayments()`.
- [ ] **Step 4:** Panggil sapuan baru dari `GET /api/secondary` di samping `expireStaleListings()`.
- [ ] **Step 5:** jalankan → PASS; gates + commit.

---

### Task 6: P1 — UI pembelian secondary mengarah ke Snap

**Files:**
- Modify: `src/app/app/secondary/page.tsx`
- Test: `src/tests/secondary-buy-ui.test.tsx`

- [ ] **Step 1:** Tes gagal — klik **Beli** → navigasi ke `redirectUrl` respons; `simulate: true` → `/app/bayar-simulasi/<orderId>`.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implement — `POST /api/secondary/buy` → `router.push(body.redirectUrl)`; tombol memuat saat menunggu; error respons jadi pesan Indonesia.
- [ ] **Step 4:** jalankan → PASS; gates + commit.

---

### Task 7: P2 — Distribusi laba mengkredit saldo investor secara idempoten

**Files:**
- Create: `src/lib/profit-payout.ts`
- Modify: `src/app/api/admin/profit/route.ts`
- Test: `src/tests/profit-payout.test.ts`

**Interfaces:**
```typescript
export interface PayoutLine { userId: string; amount: number }
export function payoutOrderId(distId: string, userId: string): string  // `PAYOUT-<distId>-<userId>`
export function splitInvestorShare(params: {
  investorShare: number; totalLots: number;
  lotOwners: { userId: string; lotStart: number; lotEnd: number }[];
  fullOwners: { userId: string }[];
}): PayoutLine[]
export async function distributeAndCredit(tx, distributionId: string): Promise<boolean>
```

- [ ] **Step 1: Tulis tes gagal**

```typescript
it('membagi pro-rata per lot', () => {
  const lines = splitInvestorShare({
    investorShare: 400_000, totalLots: 1000,
    lotOwners: [{ userId: 'a', lotStart: 1, lotEnd: 100 }, { userId: 'b', lotStart: 101, lotEnd: 150 }],
    fullOwners: [],
  });
  expect(lines).toEqual([{ userId: 'a', amount: 40_000 }, { userId: 'b', amount: 20_000 }]);
});
it('FULL mengambil 100% investorShare', () => {});
it('PENDING->DISTRIBUTED hanya sekali; kedua kalinya tidak mengkredit', async () => {});
it('orderId payout unik', () => { expect(payoutOrderId('d1', 'u1')).toBe('PAYOUT-d1-u1'); });
```

- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implement — `floor(investorShare * lotCount / totalLots)` per baris; bila ada FULL → satu baris `investorShare` penuh; sisa pembulatan tidak dibagikan. `distributeAndCredit`: `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'DISTRIBUTED', ... } })`, `count === 0` → `false`; selanjutnya baca paket + kepemilikan, lalu per baris `transaction.create({ orderId: payoutOrderId(...) })` + `investorBalance.upsert({ availableBalance: { increment } })`.
- [ ] **Step 4:** Hook `distributeAndCredit` ke `markPaid` **dan** `distribute` di `src/app/api/admin/profit/route.ts`.
- [ ] **Step 5:** jalankan → PASS; gates + commit.

---

### Task 8: P3 — Penarikan dana mengunci saldo saat pengajuan + persetujuan

**Files:**
- Create: `src/lib/withdrawal.ts`
- Modify: `src/app/api/withdrawals/route.ts` (POST)
- Create: `src/app/api/admin/withdrawals/[id]/route.ts`
- Test: `src/tests/withdrawal.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function createWithdrawal(userId, amount, destination): Promise<Withdrawal>
  export async function settleWithdrawal(tx, id, action: 'APPROVED' | 'REJECTED' | 'PAID', actorId?): Promise<void>
  ```

- [ ] **Step 1: Tulis tes gagal**
  - `createWithdrawal` menolak `amount > availableBalance`.
  - Dua `createWithdrawal` bersaing yang totalnya melebihi saldo → hanya satu berhasil (`availableBalance.decrement` dipanggil di dalam `$transaction` dengan guard `gte`).
  - `APPROVED` tidak mengubah saldo; `REJECTED` mengembalikan saldo (`increment`); `PAID` tidak mengubah saldo lagi; transisi tidak sah (mis. `PAID` dari `PENDING`) → throw.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implement `createWithdrawal` — satu `$transaction`: `updateMany({ where: { userId, availableBalance: { gte: amount } }, data: { availableBalance: { decrement: amount } } })`, `count === 0` → throw `SALDO_TIDAK_CUKUP`; `withdrawal.create` `status: 'PENDING'`.
- [ ] **Step 4:** Implement `settleWithdrawal` — `updateMany` status-guard; `REJECTED` → `increment` kembali + catat `note`.
- [ ] **Step 5:** `POST /api/withdrawals` memanggil `createWithdrawal`; buat `src/app/api/admin/withdrawals/[id]/route.ts` `PATCH` menerima `{ action }` dan hanya ADMIN/OPERATOR.
- [ ] **Step 6:** jalankan → PASS; gates + commit.

---

### Task 9: P3 — Konsol `/op/penarikan`

**Files:**
- Create: `src/app/op/penarikan/page.tsx`
- Modify: `src/app/op/layout.tsx` (tambah item nav **Penarikan**)
- Create: `src/app/api/admin/withdrawals/route.ts` (GET daftar)
- Test: `src/tests/withdrawal-console.test.tsx`

- [ ] **Step 1: Tes gagal** — baris `PENDING` menampilkan tombol **Setujui** dan **Tolak**; baris `APPROVED` menampilkan **Tandai Dibayar**; klik memanggil `PATCH /api/admin/withdrawals/<id>` lalu refresh data; status berubah sesuai (`APPROVED` / `REJECTED` / `PAID`).
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implement — tabel + status Badge + dua tombol (min 44px), dialog konfirmasi, empty/loading/error state, copy Indonesia.
- [ ] **Step 4:** jalankan → PASS; gates + commit.

---

### Task 10: P4 — Takeover memindahkan aset ke akun treasury

**Files:**
- Modify: `src/lib/secondary.ts` (atau modul takeover terkait)
- Test: `src/tests/takeover-treasury.test.ts`

**Interfaces:**
- Consumes: `TREASURY_USERNAME` / `ensureTreasuryUser` (Task 2).

- [ ] **Step 1: Tes gagal** — setelah takeover, `LotOwnership` yang tadinya milik penjual kini `userId = <id treasury>`; penjual tidak lagi memiliki baris; saldo penjual tercredit 100% (perilaku lama tetap).
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implement — dalam satu `$transaction`: `ensureTreasuryUser(tx)` untuk mendapat id, pindahkan kepemilikan (`lotOwnership.updateMany({ where: { packageId }, data: { userId: treasuryId } })` untuk baris milik penjual — **atau** `fullOwnership` bila FULL), `fullOwnership` ditandai milik treasury, listing → `TAKEOVER`, kredit penjual.
- [ ] **Step 4:** jalankan → PASS; gates + commit.

---

### Task 11: B1 — Konsol manajemen pengguna `/op/pengguna`

**Files:**
- Create: `src/app/api/admin/users/route.ts` (GET), `src/app/api/admin/users/[id]/route.ts` (PATCH)
- Create: `src/app/op/pengguna/page.tsx`
- Test: `src/tests/user-console.test.tsx`

- [ ] **Step 1: Tes gagal** — daftar pengguna memuat data; `PATCH` mengubah `status` VERIFIED/SUSPENDED dan `role`; operator **tidak** boleh mengubah role (403).
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implement — API memakai `requireRole(['ADMIN'])` untuk ubah role; `['ADMIN','OPERATOR']` untuk ubah status. UI: tabel + pencarian + Badge status + dialog ubah status/role + guard role dari session.
- [ ] **Step 4:** jalankan → PASS; gates + commit.

---

### Task 12: B3 — Penjual membatalkan listingnya sendiri

**Files:**
- Create: `src/app/api/secondary/[id]/route.ts` (baru — saat ini hanya ada `/`, `/buy`, `/list`)
- Modify: `src/app/app/secondary/page.tsx`
- Test: `src/tests/secondary-cancel.test.ts`

- [ ] **Step 1: Tes gagal** — pemilik `ACTIVE` listing → status jadi `CANCELLED`, `lotOwnership` tidak berubah, pemilik `PENDING_PAYMENT` → 409.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3: Implement** — `updateMany({ where: { id, sellerId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })`, count 0 → 409. Tombol **Batalkan** di listing milik sendiri + konfirmasi.
- [ ] **Step 4:** jalankan → PASS; gates + commit.

---

### Task 13: B4 — Pemisahan hak akses ADMIN vs OPERATOR

**Files:**
- Modify: API admin yang mengubah data sensitif (profit, settings, users role)
- Test: `src/tests/role-separation.test.ts`

- [ ] **Step 1: Tes gagal** — operator menerima 403 untuk `POST /api/admin/profit` (markPaid/distribute), `PUT /api/admin/settings` (kunci `secondary_admin_fee_*`, `profit_split_*`), dan ubah role user; admin tetap 200.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3: Implement** — tambah guard `requireRole(['ADMIN'])` pada titik-titik tersebut; operator tetap boleh `/op` lain.
- [ ] **Step 4:** jalankan → PASS; gates + commit.

---

## Akhir Fase 1+2

Setelah Task 13:

1. `npx tsc --noEmit && npm run lint && npx vitest run` — semua hijau.
2. E2E hidup dengan skrip `/tmp/opencode/e2e-accumulation.sh` tetap **22 PASS / 0 FAIL** (regresi).
3. E2E baru: pembelian secondary → settle `MID-<orderId>` → aset pindah + penjual tercredit; `markPaid` dua kali → saldo tercredit sekali.
4. `bash deploy/deploy.sh` exit 0, health 200.
5. `git push origin HEAD:main`.

**Ruang lingkup berikutnya (terpisah, rencana lain):** Fase 3 UI quick wins, Fase 4 brand/a11y, Fase 5 form & landing, Fase 6 skalabilitas.
