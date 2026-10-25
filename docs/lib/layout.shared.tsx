import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Mark } from '@/components/mark';
import { localePrefix } from './i18n';
import { messages } from './messages';
import { appName, panelDocsUrl, repoUrl } from './shared';

export function baseOptions(lang: string): BaseLayoutProps {
  const prefix = localePrefix(lang);
  const m = messages(lang);
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <Mark className="h-6" />
          {appName}
        </span>
      ),
      url: `${prefix}/`,
    },
    githubUrl: repoUrl,
    links: [
      { text: m.documentation, url: `${prefix}/docs`, active: 'nested-url' },
      { text: m.panelDocs, url: `${panelDocsUrl}${prefix}/docs`, external: true },
    ],
  };
}
