import { Badge, MantineColor } from '@mantine/core';

export const STATUS_COLORS: Record<string, MantineColor> = {
  ACTIVE: 'green',
  PENDING: 'yellow',
  VERIFIED: 'green',
  OPEN: 'blue',
  RUNNING: 'teal',
  CLOSED: 'gray',
  SOLD_OUT: 'orange',
  DRAFT: 'gray',
  PAID: 'green',
  EXPIRED: 'red',
  CANCELLED: 'red',
  TAKEOVER: 'orange',
  REJECTED: 'red',
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || 'gray';
  
  return (
    <Badge color={color} variant="light" data-status={status}>
      {label || status}
    </Badge>
  );
}
