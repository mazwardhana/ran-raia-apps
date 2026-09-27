/**
 * Seed script for Raia database.
 * Run: npx tsx prisma/seed.ts
 * Uses deterministic pseudo-random seeded by package.code hash so data is reproducible.
 */

import { PrismaClient, Role, KycStatus, AnimalType, PackageStatus, EventType } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { siteProjects } from './seed-data/site-projects';
import { users } from './seed-data/users';
import { packages } from './seed-data/packages';
import { articles } from './seed-data/articles';
import { settings } from './seed-data/settings';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

// ── Deterministic pseudo-random seeded by a string ─────────────────────────────
// True deterministic PRNG using a simple linear congruential generator

function seededRandom(seed: string): () => number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash & hash; // force 32-bit
  }
  let state = (hash >>> 0) || 1; // ensure non-zero
  return function () {
    // Simple LCG: next = (a * state + c) mod m
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randItem<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randDate(rng: () => number, start: Date, end: Date): Date {
  return new Date(start.getTime() + rng() * (end.getTime() - start.getTime()));
}

// ── Hash password ─────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// ── Main seed ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Raia database...');

  // Reference date for deterministic derived data (fixed so runs are reproducible)
  const REF = new Date('2026-09-15T00:00:00.000Z');
  const daysAgo = (n: number) => new Date(REF.getTime() - n * 86400000);

  // 0. Wipe derived data first (idempotent re-runs)
  console.log('  • Cleaning derived data...');
  await prisma.secondarySale.deleteMany();
  await prisma.secondaryListing.deleteMany();
  await prisma.lotOwnership.deleteMany();
  await prisma.fullOwnership.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.milkLog.deleteMany();
  await prisma.livestockEvent.deleteMany();
  await prisma.livestock.deleteMany();
  await prisma.profitDistribution.deleteMany();
  await prisma.taawunClaim.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.investorBalance.deleteMany();

  // 1. Settings
  console.log('  • Settings...');
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { id: s.id },
      update: { value: s.value },
      create: { id: s.id, value: s.value },
    });
  }

  // 2. Site Projects
  console.log('  • Site Projects...');
  const siteMap: Record<string, string> = {};
  for (const sp of siteProjects) {
    const site = await prisma.siteProject.upsert({
      where: { code: sp.code },
      update: { name: sp.name },
      create: {
        code: sp.code,
        name: sp.name,
        legalEntity: sp.legalEntity,
        legalNumber: sp.legalNumber,
        npwp: sp.npwp,
        address: sp.address,
        province: sp.province,
        city: sp.city,
        village: sp.village,
        contactPerson: sp.contactPerson,
        contactPhone: sp.contactPhone,
        description: sp.description,
        capacity: sp.capacity,
        status: sp.status,
      },
    });
    siteMap[sp.code] = site.id;
  }

  // 3. Users
  console.log('  • Users...');
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userMap: Record<string, string> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { username: u.username },
      create: {
        username: u.username,
        email: u.email,
        passwordHash,
        name: u.name,
        phone: u.phone,
        role: u.role as Role,
        kycStatus: u.kycStatus as KycStatus,
      },
    });
    userMap[u.username] = user.id;
  }

  // 4. Packages + PackageCost
  console.log('  • Packages + Costs...');
  const pkgMap: Record<string, string> = {};
  for (const pkg of packages) {
    const siteId = siteMap[pkg.siteCode];
    if (!siteId) { console.warn(`    ⚠ No site for ${pkg.siteCode}`); continue; }

    const created = await prisma.package.upsert({
      where: { code: pkg.code },
      update: { soldLots: pkg.soldLots, status: pkg.status },
      create: {
        code: pkg.code,
        title: pkg.title,
        animalType: pkg.animalType as AnimalType,
        siteProjectId: siteId,
        periodMonths: pkg.periodMonths,
        price: pkg.price,
        lotPrice: pkg.lotPrice,
        totalLots: pkg.totalLots,
        soldLots: pkg.soldLots,
        status: pkg.status as PackageStatus,
        coverImage: pkg.coverImage,
        description: pkg.description,
        estimatedRoi: pkg.estimatedRoi,
        estimatedOffspring: pkg.estimatedOffspring,
        estimatedOffspringPrice: pkg.estimatedOffspringPrice,
        estimatedMilkMonthly: pkg.estimatedMilkMonthly,
        estimatedMilkPrice: pkg.estimatedMilkPrice,
        startDate: pkg.startDate ? new Date(pkg.startDate) : null,
        endDate: pkg.endDate ? new Date(pkg.endDate) : null,
        maxInvestors: pkg.maxInvestors,
      },
    });
    pkgMap[pkg.code] = created.id;

    // Package costs
    for (const cost of pkg.costs) {
      await prisma.packageCost.upsert({
        where: { id: `${created.id}-${cost.costType}` },
        update: { amount: cost.amount },
        create: {
          id: `${created.id}-${cost.costType}`,
          packageId: created.id,
          costType: cost.costType,
          amount: cost.amount,
          description: cost.description,
        },
      });
    }
  }

  // 5. Investor Balances
  console.log('  • Investor Balances...');
  const investors = users.filter(u => u.role === 'INVESTOR');
  for (const inv of investors) {
    const userId = userMap[inv.username];
    if (!userId) continue;
    await prisma.investorBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, availableBalance: 0, withdrawnBalance: 0, totalEarned: 0 },
    });
  }

  // 6. Transactions + Ownership for all packages with soldLots > 0
  console.log('  • Transactions + Ownership...');
  const packagesWithSales = packages.filter(p => p.soldLots > 0);

  // Paket utuh: first 2 fully-sold RUNNING packages get a single FULL owner
  const fullCodes = packages
    .filter(p => p.status === 'RUNNING' && p.soldLots === p.totalLots)
    .slice(0, 2)
    .map(p => p.code);

  const investorUsernames = investors.map(u => u.username);
  const runningPackages = packages.filter(p => p.status === 'RUNNING' && p.soldLots > 0);

  for (const pkg of packagesWithSales) {
    const pkgId = pkgMap[pkg.code];
    if (!pkgId) continue;

    const pkgRng = seededRandom(pkg.code);
    const lotPrice = pkg.lotPrice;

    if (fullCodes.includes(pkg.code)) {
      // Paket utuh: satu investor memiliki seluruh paket
      const shuffled = [...investorUsernames].sort(() => pkgRng() - 0.5);
      const owner = shuffled[0];
      const userId = userMap[owner];
      if (!userId) continue;

      const tx = await prisma.transaction.create({
        data: {
          orderId: `ORD-FULL-${pkg.code}-${owner}`,
          userId,
          packageId: pkgId,
          type: 'BUY',
          status: 'PAID',
          amount: pkg.price,
          adminFee: 0,
          lotCount: null,
          paidAt: randDate(pkgRng, daysAgo(300), daysAgo(30)),
        },
      });

      await prisma.fullOwnership.create({
        data: {
          transactionId: tx.id,
          userId,
          packageId: pkgId,
          acquiredPrice: pkg.price,
        },
      });
      continue;
    }

    // Distribute soldLots across 1-4 investors as LOT chunks (50/100/300/500/1000)
    const n = Math.min(randInt(pkgRng, 1, 4), investorUsernames.length);
    const shuffled = [...investorUsernames].sort(() => pkgRng() - 0.5);
    const chunkCandidates = [50, 100, 300, 500, 1000];

    let remaining = pkg.soldLots;
    let lotsAssigned = 0;

    for (let i = 0; i < n && remaining > 0; i++) {
      const isLast = i === n - 1;
      let lots: number;
      if (isLast) {
        lots = remaining; // last owner takes the rest → sum always == soldLots
      } else {
        const maxAllowed = remaining - (n - 1 - i) * 50; // keep ≥50 for each later owner
        const candidates = chunkCandidates.filter(c => c <= maxAllowed);
        lots = candidates.length
          ? candidates[Math.floor(pkgRng() * candidates.length)]
          : Math.max(50, Math.min(remaining, maxAllowed));
      }
      if (lots <= 0) break;

      const userId = userMap[shuffled[i]];
      if (!userId) break;

      const amount = lots * lotPrice;
      const tx = await prisma.transaction.create({
        data: {
          orderId: `ORD-${pkg.code}-${shuffled[i]}`,
          userId,
          packageId: pkgId,
          type: 'BUY',
          status: 'PAID',
          amount,
          adminFee: 0,
          lotCount: lots,
          paidAt: randDate(pkgRng, daysAgo(300), daysAgo(30)),
        },
      });

      await prisma.lotOwnership.create({
        data: {
          transactionId: tx.id,
          userId,
          packageId: pkgId,
          lotStart: lotsAssigned + 1,
          lotEnd: lotsAssigned + lots,
          acquiredPrice: lotPrice,
        },
      });

      lotsAssigned += lots;
      remaining -= lots;
    }
  }

  // 7. Livestock + Events + MilkLog + ProfitDistribution (RUNNING packages)
  console.log('  • Livestock + Events + Milk + Profit...');

  for (const pkg of runningPackages) {
    const pkgId = pkgMap[pkg.code];
    if (!pkgId) continue;

    const pkgRng = seededRandom(pkg.code + '-livestock');
    const numLivestock = randInt(pkgRng, 5, 8); // min 5 × 10 RUNNING = 50+

    const sexes = ['JANTAN', 'BETINA'] as const;
    const breeds = pkg.animalType === 'KAMBING'
      ? ['Etawa', 'Kupang', 'Borneo', 'Garut', 'Boer', 'Lokal']
      : ['Limosin', 'Brahman', 'Sapi Lokal', 'Boer', 'Ongole'];
    const tags: string[] = [];

    for (let i = 0; i < numLivestock; i++) {
      const tag = `TAG-${pkg.code.replace('PKT-', '')}-${String(i + 1).padStart(3, '0')}`;
      tags.push(tag);

      const sex = randItem(pkgRng, sexes);
      const breed = randItem(pkgRng, breeds);
      const daysOld = randInt(pkgRng, 60, 900);
      const birthDate = new Date(REF.getTime() - daysOld * 86400000);

      const livestock = await prisma.livestock.create({
        data: {
          packageId: pkgId,
          tagNumber: tag,
          name: `${breed} #${i + 1}`,
          sex,
          breed,
          birthDate,
          weightKg: pkg.animalType === 'SAPI' ? parseFloat((pkgRng() * 2 + 3).toFixed(1)) : null,
          status: 'ACTIVE',
        },
      });

      // 1-2 LivestockEvent
      const numEvents = randInt(pkgRng, 1, 2);
      const eventTypes: EventType[] = ['BIRTH', 'MILK', 'HEALTH_CHECK', 'VACCINATION', 'WEIGHT_LOG'];
      for (let e = 0; e < numEvents; e++) {
        const evtType = randItem(pkgRng, eventTypes);
        await prisma.livestockEvent.create({
          data: {
            livestockId: livestock.id,
            eventType: evtType,
            eventDate: randDate(pkgRng, birthDate, REF),
            description: `Event ${evtType.toLowerCase()} untuk ${livestock.tagNumber}`,
            reportedBy: 'system',
          },
        });
      }

      // MilkLog (only for KAMBING)
      if (pkg.animalType === 'KAMBING') {
        const milkDate = randDate(pkgRng, daysAgo(270), REF);
        await prisma.milkLog.create({
          data: {
            livestockId: livestock.id,
            logDate: milkDate,
            morningLt: parseFloat((pkgRng() * 1.5 + 0.5).toFixed(2)),
            eveningLt: parseFloat((pkgRng() * 1.5 + 0.5).toFixed(2)),
            totalLt: parseFloat((pkgRng() * 2.5 + 1).toFixed(2)),
            fatPercent: parseFloat((pkgRng() * 2 + 3).toFixed(2)),
            proteinPercent: parseFloat((pkgRng() * 1 + 2.5).toFixed(2)),
          },
        });
      }
    }

    // 1-2 ProfitDistribution
    const numProfits = randInt(pkgRng, 1, 2);
    const profitSources = pkg.animalType === 'KAMBING' ? ['OFFSPRING', 'MILK'] : ['OFFSPRING'];
    for (let p = 0; p < numProfits; p++) {
      const source = randItem(pkgRng, profitSources);
      const grossAmount = source === 'OFFSPRING'
        ? randInt(pkgRng, 5_000_000, 20_000_000)
        : randInt(pkgRng, 2_000_000, 10_000_000);

      await prisma.profitDistribution.create({
        data: {
          packageId: pkgId,
          source,
          grossAmount,
          raiaShare: Math.floor((grossAmount * 60) / 100),
          investorShare: grossAmount - Math.floor((grossAmount * 60) / 100),
          period: source === 'MILK' ? '2026-08' : '2026-Q2',
          status: 'DISTRIBUTED',
          distributedAt: daysAgo(14),
          note: `Distribusi ${source.toLowerCase()} periode ${source === 'MILK' ? 'Agustus 2026' : 'Q2 2026'}`,
        },
      });
    }
  }

  // 8. InvestorBalance updates for packages with profit
  console.log('  • Investor Balance updates...');
  const profitDists = await prisma.profitDistribution.findMany({
    where: { status: 'DISTRIBUTED' },
    include: { package: true },
  });

  for (const dist of profitDists) {
    // Paket utuh: satu FullOwnership menerima seluruh share investor
    const fullOwners = await prisma.fullOwnership.findMany({
      where: { packageId: dist.packageId },
    });
    if (fullOwners.length > 0) {
      for (const fo of fullOwners) {
        if (dist.investorShare <= 0) continue;
        await prisma.investorBalance.update({
          where: { userId: fo.userId },
          data: {
            availableBalance: { increment: dist.investorShare },
            totalEarned: { increment: dist.investorShare },
          },
        });
      }
      continue;
    }

    const ownerships = await prisma.lotOwnership.findMany({
      where: { packageId: dist.packageId },
    });

    const totalOwned = ownerships.reduce((s, o) => s + (o.lotEnd - o.lotStart + 1), 0);
    if (totalOwned === 0) continue;

    for (const ow of ownerships) {
      const ownedLots = ow.lotEnd - ow.lotStart + 1;
      const share = Math.floor((dist.investorShare * ownedLots) / totalOwned);
      if (share <= 0) continue;

      await prisma.investorBalance.update({
        where: { userId: ow.userId },
        data: {
          availableBalance: { increment: share },
          totalEarned: { increment: share },
        },
      });
    }
  }

  // 9. Secondary Listings: 2 ACTIVE, 1 EXPIRED, 1 SOLD
  console.log('  • Secondary Listings...');

  // Get some lot ownerships for secondary listings
  const sampleOwnerships = await prisma.lotOwnership.findMany({ take: 10 });

  if (sampleOwnerships.length >= 4) {
    const now = new Date(); // For ACTIVE listings: expiresAt must be in future
    
    // 2 ACTIVE listings (dates relative to run time to keep them active)
    for (let i = 0; i < 2; i++) {
      const ow = sampleOwnerships[i];
      const pkg = await prisma.package.findUnique({ where: { id: ow.packageId } });
      if (!pkg) continue;
      const listedAt = new Date(now.getTime() - 2 * 86400000); // 2 days ago
      const expiresAt = new Date(listedAt.getTime() + 7 * 86400000); // +7 days

      await prisma.secondaryListing.create({
        data: {
          sellerId: ow.userId,
          packageId: ow.packageId,
          ownershipType: 'LOT',
          lotStart: ow.lotStart,
          lotEnd: ow.lotEnd,
          listingPrice: pkg.lotPrice,
          status: 'ACTIVE',
          listedAt,
          expiresAt,
          takeoverByRaia: false,
        },
      });
    }

    // 1 EXPIRED listing (fixed dates)
    const expiredOw = sampleOwnerships[2];
    const expiredPkg = await prisma.package.findUnique({ where: { id: expiredOw.packageId } });
    if (expiredPkg) {
      const listedAt = daysAgo(12); // REF - 12 days
      const expiresAt = daysAgo(5); // REF - 5 days (expired)
      await prisma.secondaryListing.create({
        data: {
          sellerId: expiredOw.userId,
          packageId: expiredOw.packageId,
          ownershipType: 'LOT',
          lotStart: expiredOw.lotStart,
          lotEnd: expiredOw.lotEnd,
          listingPrice: expiredPkg.lotPrice,
          status: 'EXPIRED',
          listedAt,
          expiresAt,
          takeoverByRaia: true,
        },
      });
    }

    // 1 SOLD listing (fixed dates)
    const soldOw = sampleOwnerships[3];
    const soldPkg = await prisma.package.findUnique({ where: { id: soldOw.packageId } });
    if (soldPkg) {
      const listedAt = daysAgo(20);
      const expiresAt = daysAgo(13);
      const soldAt = daysAgo(17);
      const listing = await prisma.secondaryListing.create({
        data: {
          sellerId: soldOw.userId,
          packageId: soldOw.packageId,
          ownershipType: 'LOT',
          lotStart: soldOw.lotStart,
          lotEnd: soldOw.lotEnd,
          listingPrice: soldPkg.lotPrice,
          status: 'SOLD',
          listedAt,
          expiresAt,
          soldAt,
          takeoverByRaia: false,
        },
      });

      // SecondarySale
      const buyerOw = sampleOwnerships[4];
      if (buyerOw) {
        await prisma.secondarySale.create({
          data: {
            listingId: listing.id,
            buyerId: buyerOw.userId,
            adminFee: 0,
            finalPrice: soldPkg.lotPrice,
            soldAt,
          },
        });
      }
    }
  }

  // 10. Articles
  console.log('  • Articles...');
  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {},
      create: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        coverImage: article.coverImage,
        authorName: article.authorName,
        publishedAt: article.publishedAt,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        keywords: article.keywords,
      },
    });
  }

  // ── Verification counts ──────────────────────────────────────────────────────
  console.log('\n✅ Seed complete! Counts:');
  const counts = {
    SiteProject: await prisma.siteProject.count(),
    Package: await prisma.package.count(),
    User: await prisma.user.count(),
    Article: await prisma.article.count(),
    Setting: await prisma.setting.count(),
    Livestock: await prisma.livestock.count(),
    Transaction: await prisma.transaction.count(),
    SecondaryListing: await prisma.secondaryListing.count(),
  };
  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model}: ${count}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
