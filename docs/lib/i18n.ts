import { defineI18n } from 'fumadocs-core/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';

// Same layout as the We1ssBoard docs: English at /docs, Russian at /ru/docs.
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'ru'],
  parser: 'dir',
  hideLocale: 'default-locale',
});

export type Locale = (typeof i18n.languages)[number];

export const { provider } = defineI18nUI(i18n, {
  en: { displayName: 'English' },
  ru: { displayName: 'Русский' },
});

export function localePrefix(lang: string): string {
  return lang === i18n.defaultLanguage ? '' : `/${lang}`;
}
