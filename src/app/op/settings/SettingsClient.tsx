'use client';

import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SettingMeta {
  label: string;
  description: string;
  unit: 'percent' | 'rupiah' | 'days' | 'number';
}

const META: Record<string, SettingMeta> = {
  raia_share_percent: {
    label: 'Bagian Raia (%)',
    description:
      'Persentase bagi hasil untuk Raia. Harus berjumlah 100% dengan bagian investor.',
    unit: 'percent',
  },
  investor_share_percent: {
    label: 'Bagian Investor (%)',
    description:
      'Persentase bagi hasil untuk investor. Harus berjumlah 100% dengan bagian Raia.',
    unit: 'percent',
  },
  min_checkout: {
    label: 'Minimum checkout (Rp)',
    description: 'Nilai minimum pembelian lot dalam satu transaksi.',
    unit: 'rupiah',
  },
  default_lot_price: {
    label: 'Harga lot default (Rp)',
    description: 'Harga satu lot ketika paket tidak menentukan sendiri.',
    unit: 'rupiah',
  },
  taawun_year_1: {
    label: "Rate ta'awun tahun ke-1 (Rp)",
    description: 'Batas klaim ta\'awun maksimal untuk tahun pertama.',
    unit: 'rupiah',
  },
  taawun_year_2_plus: {
    label: "Rate ta'awun tahun ke-2 (Rp)",
    description: 'Batas klaim ta\'awun maksimal untuk tahun kedua dan seterusnya.',
    unit: 'rupiah',
  },
  secondary_market_days: {
    label: 'Masa tayang secondary (hari)',
    description: 'Lama listing secondary market sebelum kedaluwarsa.',
    unit: 'days',
  },
  secondary_admin_fee_percent: {
    label: 'Biaya admin secondary (%)',
    description: 'Persentase biaya admin transaksi secondary market.',
    unit: 'percent',
  },
  secondary_admin_fee_flat: {
    label: 'Biaya admin secondary tetap (Rp)',
    description: 'Biaya admin secondary dalam rupiah tetap (0 = tanpa biaya).',
    unit: 'rupiah',
  },
};

const SPLIT_KEYS = ['raia_share_percent', 'investor_share_percent'];

function validate(
  key: string,
  value: string,
  drafts: Record<string, string>,
  originals: Record<string, string>
): string | null {
  const meta = META[key];
  if (!meta) return `Pengaturan "${key}" tidak dikenal`;

  const numeric = Number(value);
  if (value.trim() === '' || !Number.isFinite(numeric)) {
    return `Nilai "${meta.label}" harus berupa angka`;
  }
  if (!Number.isInteger(numeric) || numeric < 0) {
    return `Nilai "${meta.label}" harus bilangan bulat positif`;
  }
  if (meta.unit === 'percent' && numeric > 100) {
    return `Nilai "${meta.label}" harus antara 0 dan 100`;
  }

  if (SPLIT_KEYS.includes(key)) {
    const otherKey = SPLIT_KEYS[0] === key ? SPLIT_KEYS[1] : SPLIT_KEYS[0];
    const otherValue = Number(drafts[otherKey] ?? originals[otherKey] ?? 0);
    const total = numeric + otherValue;
    if (total !== 100) {
      return `Total pembagian profit harus 100%, saat ini ${numeric}% + ${otherValue}% = ${total}%`;
    }
  }

  return null;
}

export function SettingsClient({ items }: { items: Array<{ key: string; value: string }> }) {
  const router = useRouter();

  const [originals, setOriginals] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.key, item.value]))
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.key, item.value]))
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  const dirtyKeys = items
    .map((item) => item.key)
    .filter((key) => drafts[key] !== originals[key]);
  const anySaving = savingKey !== null;

  function setDraft(key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    setSaved((prev) => ({ ...prev, [key]: false }));
    setErrors((prev) => ({ ...prev, [key]: null }));
    setGlobalNotice(null);
  }

  async function saveKey(key: string): Promise<boolean> {
    const value = drafts[key];
    const problem = validate(key, value, drafts, originals);
    if (problem) {
      setErrors((prev) => ({ ...prev, [key]: problem }));
      return false;
    }

    setSavingKey(key);
    setGlobalError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [key]: json.error || 'Gagal menyimpan' }));
        return false;
      }

      setErrors((prev) => ({ ...prev, [key]: null }));
      setSaved((prev) => ({ ...prev, [key]: true }));
      setOriginals((prev) => ({ ...prev, [key]: value }));
      return true;
    } catch {
      setErrors((prev) => ({
        ...prev,
        [key]: 'Tidak dapat terhubung ke server. Coba lagi.',
      }));
      return false;
    } finally {
      setSavingKey(null);
    }
  }

  async function saveAll() {
    setGlobalNotice(null);
    setGlobalError(null);
    const failed: string[] = [];
    for (const key of dirtyKeys) {
      const ok = await saveKey(key);
      if (!ok) failed.push(key);
    }
    if (failed.length > 0) {
      setGlobalError(`${failed.length} pengaturan gagal disimpan. Periksa pesan di baris tersebut.`);
    } else if (dirtyKeys.length > 0) {
      setGlobalNotice(`${dirtyKeys.length} pengaturan tersimpan.`);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" c="dimmed">
          {dirtyKeys.length > 0
            ? `${dirtyKeys.length} perubahan belum disimpan.`
            : 'Semua perubahan sudah tersimpan.'}
        </Text>
        <Button
          leftSection={<IconDeviceFloppy size={18} />}
          onClick={saveAll}
          disabled={dirtyKeys.length === 0 || anySaving}
          loading={anySaving}
          h={44}
        >
          Simpan Semua
        </Button>
      </Group>

      {globalNotice && (
        <Alert color="green" variant="light" title="Berhasil">
          {globalNotice}
        </Alert>
      )}
      {globalError && (
        <Alert color="red" variant="light" title="Gagal">
          {globalError}
        </Alert>
      )}

      {items.map((item) => {
        const meta = META[item.key];
        const dirty = drafts[item.key] !== originals[item.key];
        const rowError = errors[item.key];

        return (
          <Paper key={item.key} withBorder p="md">
            <Stack gap="xs">
              <Group justify="space-between" wrap="wrap" align="flex-start">
                <Stack gap={4} style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <Group gap="xs" wrap="wrap">
                    <Text fw={600} size="sm">
                      {meta?.label ?? item.key}
                    </Text>
                    {dirty && (
                      <Badge color="orange" size="sm">
                        Belum disimpan
                      </Badge>
                    )}
                    {!dirty && saved[item.key] && (
                      <Badge color="green" size="sm">
                        Tersimpan
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {meta?.description ?? 'Tidak ada deskripsi.'}
                  </Text>
                </Stack>

                <Group gap="xs" wrap="nowrap">
                  <NumberInput
                    aria-label={meta?.label ?? item.key}
                    value={drafts[item.key]}
                    onChange={(value) =>
                      setDraft(item.key, value === '' ? '' : String(value))
                    }
                    min={0}
                    step={meta?.unit === 'percent' ? 1 : 1000}
                    style={{ width: 170 }}
                    styles={{ input: { minHeight: 44 } }}
                  />
                  <Button
                    leftSection={<IconCheck size={16} />}
                    onClick={() => saveKey(item.key)}
                    disabled={!dirty}
                    loading={savingKey === item.key}
                    variant={dirty ? 'filled' : 'default'}
                    h={44}
                  >
                    Simpan
                  </Button>
                </Group>
              </Group>

              {rowError && (
                <Alert color="red" variant="light">
                  {rowError}
                </Alert>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
