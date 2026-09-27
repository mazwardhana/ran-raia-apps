import { Select, SelectProps } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect, useRef, useState } from 'react';

export interface SearchableSelectProps extends Omit<SelectProps, 'data' | 'searchable'> {
  data: { value: string; label: string }[];
  onSearchChange?: (query: string) => void;
}

export function SearchableSelect({
  data,
  onSearchChange,
  placeholder = 'Ketik untuk mencari...',
  nothingFoundMessage = 'Tidak ditemukan',
  ...props
}: SearchableSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (onSearchChange) {
      onSearchChange(debouncedQuery);
    }
  }, [debouncedQuery, onSearchChange]);

  const filteredData = data.filter((item) =>
    item.label.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  return (
    <Select
      {...props}
      data={filteredData}
      placeholder={placeholder}
      searchable
      nothingFoundMessage={nothingFoundMessage}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      filter={({ options }) => options}
      comboboxProps={{ keepMounted: false }}
      styles={{
        input: { minHeight: 44 },
      }}
    />
  );
}
