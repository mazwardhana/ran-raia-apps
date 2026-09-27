import { useState } from 'react';

export interface UsePaginatedQueryOptions {
  total?: number;
  initialPage?: number;
  initialPageSize?: number;
}

export function usePaginatedQuery({
  total = 0,
  initialPage = 1,
  initialPageSize = 10,
}: UsePaginatedQueryOptions = {}) {
  const [page, setPageInternal] = useState(initialPage);
  const [pageSize, setPageSizeInternal] = useState(initialPageSize);
  const [search, setSearchInternal] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setPage = (newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    setPageInternal(clampedPage);
  };

  const setPageSize = (newSize: number) => {
    setPageSizeInternal(newSize);
    setPageInternal(1);
  };

  const setSearch = (newSearch: string) => {
    setSearchInternal(newSearch);
    setPageInternal(1);
  };

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageInternal(1);
  };

  const reset = () => {
    setPageInternal(initialPage);
    setPageSizeInternal(initialPageSize);
    setSearchInternal('');
    setFilters({});
    setSort(null);
  };

  return {
    page,
    pageSize,
    search,
    filters,
    sort,
    totalPages,
    total,
    setPage,
    setPageSize,
    setSearch,
    setFilter,
    setSort,
    reset,
  };
}
