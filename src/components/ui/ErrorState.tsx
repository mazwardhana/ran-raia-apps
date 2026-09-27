import { Button, Center, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { ReactNode } from 'react';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Terjadi kesalahan',
  description = 'Tidak dapat memuat data. Silakan coba lagi.',
  icon,
  onRetry,
}: ErrorStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md" maw={400}>
        {icon || <IconAlertCircle size={48} stroke={1.5} color="var(--mantine-color-red-6)" />}
        <Stack align="center" gap="xs">
          <Text fw={600} size="lg">
            {title}
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
        </Stack>
        {onRetry && (
          <Button onClick={onRetry} mt="xs">
            Coba lagi
          </Button>
        )}
      </Stack>
    </Center>
  );
}
