'use client';

import { BarChart } from '@mantine/charts';
import { Text } from '@mantine/core';

export interface StatusCount {
  status: string;
  jumlah: number;
}

export function OverviewChart({ data }: { data: StatusCount[] }) {
  if (data.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Belum ada data paket untuk ditampilkan.
      </Text>
    );
  }

  return (
    <div role="img" aria-label="Jumlah paket per status">
      <BarChart
        h={260}
        data={data}
        dataKey="status"
        series={[{ name: 'jumlah', color: 'teal', label: 'Jumlah paket' }]}
        withTooltip
      />
    </div>
  );
}
