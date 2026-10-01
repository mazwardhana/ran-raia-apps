import { Center, Loader, Stack, Text } from '@mantine/core';

export default function Loading() {
  return (
    <Center mih="100dvh" role="status" aria-live="polite">
      <Stack align="center" gap="md">
        <Loader size="md" aria-hidden="true" />
        <Text size="sm" c="dimmed">
          Memuat...
        </Text>
      </Stack>
    </Center>
  );
}
