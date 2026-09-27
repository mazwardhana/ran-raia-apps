import { Center, Loader, Stack, Text } from '@mantine/core';

export interface LoadingStateProps {
  text?: string;
}

export function LoadingState({ text = 'Memuat...' }: LoadingStateProps) {
  return (
    <Center py="xl" role="status">
      <Stack align="center" gap="md">
        <Loader size="md" aria-hidden="true" />
        <Text size="sm" c="dimmed">
          {text}
        </Text>
      </Stack>
    </Center>
  );
}
