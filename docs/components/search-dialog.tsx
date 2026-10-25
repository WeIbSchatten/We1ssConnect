'use client';

import { create } from 'zbsearch';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { staticClient } from 'fumadocs-core/search/client/orama-static';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { useMemo } from 'react';
import { withBasePath } from '@/lib/shared';

// The static index is tokenized as English for every locale: zbsearch has no Russian tokenizer.
export default function SearchDialogClient(props: SharedProps) {
  const { locale } = useI18n();
  const client = useMemo(
    () =>
      staticClient({
        from: withBasePath('/api/search'),
        locale,
        initDB: () => create({ schema: { _: 'string' }, language: 'english' }),
      }),
    [locale],
  );
  const { search, setSearch, query } = useDocsSearch({ client });
  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
