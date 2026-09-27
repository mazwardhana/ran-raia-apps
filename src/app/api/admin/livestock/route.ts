import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { requireRole } from '@/lib/auth';
import {
  MAX_IMPORT_ROWS,
  Row,
  toLivestockCreateInputs,
  validateRows,
} from '@/lib/import-livestock';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const EVENT_TYPES = [
  'BIRTH',
  'MATING',
  'HEALTH_CHECK',
  'MILK',
  'SALE',
  'DEATH',
  'VACCINATION',
  'WEIGHT_LOG',
] as const;

const ANIMAL_TYPES = ['KAMBING', 'SAPI'] as const;

async function guard() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
    return null;
  } catch {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses.' },
      { status: 403 }
    );
  }
}

/**
 * GET /api/admin/livestock
 * ?q= pencarian tag/nama, ?animalType= filter KAMBING|SAPI,
 * ?page=&pageSize= untuk tabel. Mengembalikan list + agregat per jenis
 * dan per site proyek untuk chart.
 */
export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const params = req.nextUrl.searchParams;
    const q = (params.get('q') || '').trim();
    const animalType = (params.get('animalType') || '').trim().toUpperCase();
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 10));

    const where: Prisma.LivestockWhereInput = {};
    if (q) {
      where.OR = [
        { tagNumber: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { breed: { contains: q, mode: 'insensitive' } },
      ];
    }
    if ((ANIMAL_TYPES as readonly string[]).includes(animalType)) {
      where.package = { animalType: animalType as 'KAMBING' | 'SAPI' };
    }

    const [total, items, livestockPerAnimal] = await Promise.all([
      prisma.livestock.count({ where }),
      prisma.livestock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          package: {
            select: {
              code: true,
              title: true,
              animalType: true,
              siteProject: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.livestock.groupBy({
        by: ['packageId'],
        _count: { _all: true },
        where: { status: 'ACTIVE' },
      }),
    ]);

    // Agregat per jenis ternak & per site (dihitung dari relasi package)
    const activePackageIds = livestockPerAnimal.map((r) => r.packageId);
    const activePackages = await prisma.package.findMany({
      where: { id: { in: activePackageIds } },
      select: { id: true, animalType: true, siteProject: { select: { name: true } } },
    });
    const packageMap = new Map(activePackages.map((p) => [p.id, p]));

    const byAnimalType: Record<string, number> = { KAMBING: 0, SAPI: 0 };
    const bySite: Record<string, number> = {};
    for (const row of livestockPerAnimal) {
      const pkg = packageMap.get(row.packageId);
      const type = pkg?.animalType ?? 'LAIN';
      byAnimalType[type] = (byAnimalType[type] || 0) + row._count._all;
      const siteName = pkg?.siteProject?.name ?? 'Tanpa Site';
      bySite[siteName] = (bySite[siteName] || 0) + row._count._all;
    }

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        tagNumber: item.tagNumber,
        name: item.name,
        sex: item.sex,
        breed: item.breed,
        birthDate: item.birthDate ? item.birthDate.toISOString() : null,
        weightKg: item.weightKg,
        motherTag: item.motherTag,
        status: item.status,
        packageCode: item.package.code,
        packageTitle: item.package.title,
        animalType: item.package.animalType,
        siteName: item.package.siteProject?.name ?? '-',
      })),
      total,
      page,
      pageSize,
      aggregates: {
        byAnimalType: Object.entries(byAnimalType)
          .filter(([, value]) => value > 0)
          .map(([label, value]) => ({ label, value })),
        bySite: Object.entries(bySite).map(([label, value]) => ({ label, value })),
      },
    });
  } catch (error) {
    console.error('Error fetching livestock:', error);
    return NextResponse.json(
      { error: 'Gagal memuat data ternak.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/livestock
 * action=import {rows} | action=event {..} | action=milk {..}
 */
export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 });
  }

  const action = body.action;

  try {
    if (action === 'import') {
      return await handleImport(body);
    }
    if (action === 'event') {
      return await handleEvent(body);
    }
    if (action === 'milk') {
      return await handleMilk(body);
    }
    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (error) {
    console.error('Error livestock POST:', error);
    return NextResponse.json(
      { error: 'Gagal memproses data ternak.' },
      { status: 500 }
    );
  }
}

async function handleImport(body: Record<string, unknown>) {
  const rows = body.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { imported: 0, errors: [{ row: 0, column: 'file', message: 'Data baris tidak ditemukan.' }] },
      { status: 400 }
    );
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({
      imported: 0,
      errors: [
        {
          row: 0,
          column: 'file',
          message: `Maksimal ${MAX_IMPORT_ROWS} baris per impor.`,
        },
      ],
    });
  }

  const existing = await prisma.livestock.findMany({
    select: { tagNumber: true },
  });
  const existingTags = existing.map((l) => l.tagNumber);

  const { valid, errors } = validateRows(rows as Row[], existingTags);
  if (valid.length === 0) {
    return NextResponse.json({ imported: 0, errors });
  }

  const codes = Array.from(new Set(valid.map((r) => r.packageCode)));
  const packages = await prisma.package.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, animalType: true },
  });
  const packageByCode = new Map(packages.map((p) => [p.code, p]));

  // Cocokkan jenis_ternak CSV dengan jenis pada paket tujuan
  const packageIdByCode: Record<string, string> = {};
  packageByCode.forEach((pkg, code) => {
    packageIdByCode[code] = pkg.id;
  });
  for (const row of valid) {
    const pkg = packageByCode.get(row.packageCode);
    if (pkg && pkg.animalType !== row.animalType) {
      errors.push({
        row: row.row,
        column: 'jenis_ternak',
        message: `Jenis ternak "${row.animalType}" tidak sesuai dengan paket ${row.packageCode} (jenis paket: ${pkg.animalType}).`,
      });
    }
  }

  const mismatched = new Set(
    errors.filter((e) => e.column === 'jenis_ternak').map((e) => e.row)
  );
  const importable = valid.filter((row) => !mismatched.has(row.row));

  const { data, errors: mapErrors } = toLivestockCreateInputs(
    importable,
    packageIdByCode
  );
  errors.push(...mapErrors);

  let imported = 0;
  if (data.length > 0) {
    const result = await prisma.livestock.createMany({
      data,
      skipDuplicates: true,
    });
    imported = result.count;
  }

  return NextResponse.json({ imported, errors });
}

async function handleEvent(body: Record<string, unknown>) {
  const livestockId = typeof body.livestockId === 'string' ? body.livestockId : '';
  const eventType = typeof body.eventType === 'string' ? body.eventType : '';
  const eventDate = typeof body.eventDate === 'string' ? body.eventDate : '';
  const description =
    typeof body.description === 'string' && body.description.trim() !== ''
      ? body.description.trim()
      : null;
  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity)
      ? Math.trunc(body.quantity)
      : null;

  const errors: { column: string; message: string }[] = [];
  if (!livestockId) errors.push({ column: 'livestockId', message: 'Ternak wajib dipilih.' });
  if (!(EVENT_TYPES as readonly string[]).includes(eventType)) {
    errors.push({ column: 'eventType', message: 'Jenis event tidak valid.' });
  }
  const parsedDate = eventDate ? new Date(eventDate) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    errors.push({ column: 'eventDate', message: 'Tanggal event tidak valid.' });
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 });
  }

  const livestock = await prisma.livestock.findUnique({
    where: { id: livestockId },
    select: { id: true },
  });
  if (!livestock) {
    return NextResponse.json({ error: 'Ternak tidak ditemukan.' }, { status: 404 });
  }

  const event = await prisma.livestockEvent.create({
    data: {
      livestockId,
      eventType: eventType as (typeof EVENT_TYPES)[number],
      eventDate: parsedDate as Date,
      description,
      quantity,
      photos: [],
    },
  });

  return NextResponse.json({ event });
}

async function handleMilk(body: Record<string, unknown>) {
  const livestockId = typeof body.livestockId === 'string' ? body.livestockId : '';
  const logDate = typeof body.logDate === 'string' ? body.logDate : '';
  const morningLt =
    typeof body.morningLt === 'number' && Number.isFinite(body.morningLt)
      ? body.morningLt
      : null;
  const eveningLt =
    typeof body.eveningLt === 'number' && Number.isFinite(body.eveningLt)
      ? body.eveningLt
      : null;

  const errors: { column: string; message: string }[] = [];
  if (!livestockId) errors.push({ column: 'livestockId', message: 'Ternak wajib dipilih.' });
  const parsedDate = logDate ? new Date(logDate) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    errors.push({ column: 'logDate', message: 'Tanggal catatan tidak valid.' });
  }
  if (morningLt === null && eveningLt === null) {
    errors.push({ column: 'morningLt', message: 'Isi minimal salah satu volume susu.' });
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 });
  }

  const livestock = await prisma.livestock.findUnique({
    where: { id: livestockId },
    select: { id: true },
  });
  if (!livestock) {
    return NextResponse.json({ error: 'Ternak tidak ditemukan.' }, { status: 404 });
  }

  const totalLt = (morningLt ?? 0) + (eveningLt ?? 0);
  const log = await prisma.milkLog.create({
    data: {
      livestockId,
      logDate: parsedDate as Date,
      morningLt,
      eveningLt,
      totalLt,
    },
  });

  return NextResponse.json({ log });
}
