import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware';
import { i18n } from '@/lib/i18n';

// Dev server only: maps /docs to the hidden default locale. The static export has no middleware.
export default createI18nMiddleware(i18n);

export const config = {
  matcher: ['/((?!api|_next|.*\..*).*)'],
};
