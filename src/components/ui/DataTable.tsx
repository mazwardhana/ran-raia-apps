import {
  ActionIcon,
  Box,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export interface DataTableColumn<T> {
  accessorKey: keyof T;
  header: string;
  sortable?: boolean;
}

export interface DataTableFilter {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  filters?: DataTableFilter[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onSortChange?: (sort: { key: string; direction: 'asc' | 'desc' }) => void;
  onRowClick?: (row: T) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearchChange?: (search: string) => void;
  onFilterChange?: (key: string, value: string) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  filters = [],
  total,
  page,
  pageSize,
  loading = false,
  onSortChange,
  onRowClick,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onFilterChange,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  );
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (onSearchChange) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange]);

  const handleSort = (key: string) => {
    const newDirection: 'asc' | 'desc' =
      sortState?.key === key && sortState.direction === 'asc' ? 'desc' : 'asc';
    const newSort = { key, direction: newDirection };
    setSortState(newSort);
    if (onSortChange) {
      onSortChange(newSort);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return <LoadingState />;
  }

  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <Stack gap="md">
      <Group gap="md" wrap="wrap">
        <TextInput
          placeholder="Cari data"
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          aria-label="Cari data"
          styles={{ input: { minHeight: 44 } }}
          style={{ flex: 1, minWidth: 200 }}
        />
        {filters.map((filter) => (
          <Select
            key={filter.value}
            label={filter.label}
            data={filter.options}
            placeholder={`Pilih ${filter.label.toLowerCase()}`}
            onChange={(value) => {
              if (onFilterChange && value) {
                onFilterChange(filter.value, value);
              }
            }}
            styles={{ input: { minHeight: 44 } }}
            style={{ minWidth: 150 }}
            clearable
            comboboxProps={{ keepMounted: false }}
          />
        ))}
      </Group>

      <Paper withBorder>
        <ScrollArea>
          <Table striped highlightOnHover style={{ minWidth: 360 }}>
            <TableThead>
              <TableTr>
                {columns.map((column) => (
                  <TableTh key={String(column.accessorKey)}>
                    {column.sortable ? (
                      <Group gap={4} wrap="nowrap">
                        <button
                          onClick={() => handleSort(String(column.accessorKey))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            font: 'inherit',
                            color: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            minHeight: 44,
                          }}
                          aria-label={`Urutkan ${column.header}`}
                        >
                          {column.header}
                          {sortState?.key === String(column.accessorKey) &&
                            (sortState.direction === 'asc' ? (
                              <IconArrowUp size={14} />
                            ) : (
                              <IconArrowDown size={14} />
                            ))}
                        </button>
                      </Group>
                    ) : (
                      column.header
                    )}
                  </TableTh>
                ))}
              </TableTr>
            </TableThead>
            <TableTbody>
              {data.map((row, index) => (
                <TableTr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((column) => (
                    <TableTd key={String(column.accessorKey)}>
                      {String(row[column.accessorKey] ?? '')}
                    </TableTd>
                  ))}
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page === 1}
            aria-label="Halaman sebelumnya"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Box
            component="span"
            style={{ fontSize: 14, padding: '0 8px', minHeight: 44, display: 'flex', alignItems: 'center' }}
          >
            Halaman {page} dari {totalPages}
          </Box>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= totalPages}
            aria-label="Halaman berikutnya"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>

        <Select
          label="Baris per halaman"
          data={[
            { value: '10', label: '10' },
            { value: '25', label: '25' },
            { value: '50', label: '50' },
          ]}
          value={String(pageSize)}
          onChange={(value) => {
            if (onPageSizeChange && value) {
              onPageSizeChange(Number(value));
            }
          }}
          styles={{ input: { minHeight: 44 } }}
          style={{ width: 120 }}
          comboboxProps={{ keepMounted: false }}
        />
      </Group>
    </Stack>
  );
}
