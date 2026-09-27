import { Card, Text } from '@mantine/core';
import { ReactNode } from 'react';

export interface ChartCardProps {
  title: string;
  children: ReactNode;
}

export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <Card withBorder>
      <Text size="sm" fw={600} mb="md">
        {title}
      </Text>
      {children}
    </Card>
  );
}
