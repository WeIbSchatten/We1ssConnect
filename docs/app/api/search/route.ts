import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// Static index for `output: 'export'`.
export const revalidate = false;
export const dynamic = 'force-static';

export const { staticGET: GET } = createFromSource(source, {
  localeMap: { en: 'english', ru: 'english' },
});
