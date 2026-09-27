import { Card, Group, Stack, Text } from '@mantine/core';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { ReactNode } from 'react';

export interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: {
    direction: 'up' | 'down';
    value: string;
  };
}

export function MetricCard({ icon, label, value, trend }: MetricCardProps) {
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          {icon}
        </Group>
        <Text size="xl" fw={700}>
          {value}
        </Text>
        {trend && (
          <Group
            gap="xs"
            aria-label={`Tren ${trend.direction === 'up' ? 'naik' : 'turun'} ${trend.value}`}
          >
            {trend.direction === 'up' ? (
              <IconTrendingUp size={16} color="var(--mantine-color-green-6)" />
            ) : (
              <IconTrendingDown size={16} color="var(--mantine-color-red-6)" />
            )}
            <Text size="sm" c={trend.direction === 'up' ? 'green' : 'red'}>
              {trend.value}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
