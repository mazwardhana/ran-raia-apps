import { Button, Center, Stack, Text } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import { ReactNode } from 'react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'Belum ada data',
  description = 'Belum ada data untuk ditampilkan.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md" maw={400}>
        {icon || <IconInbox size={48} stroke={1.5} color="var(--mantine-color-gray-5)" />}
        <Stack align="center" gap="xs">
          <Text fw={600} size="lg">
            {title}
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
        </Stack>
        {action && (
          <Button onClick={action.onClick} mt="xs">
            {action.label}
          </Button>
        )}
      </Stack>
    </Center>
  );
}
