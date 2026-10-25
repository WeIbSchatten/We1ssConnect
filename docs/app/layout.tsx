import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './global.css';
import { appName, siteUrl, withBasePath } from '@/lib/shared';
import { i18n } from '@/lib/i18n';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: appName, template: `%s — ${appName}` },
  description: 'We1ssConnect: VPN client for Android, Windows, Linux and OpenWrt routers.',
  icons: { icon: withBasePath('/favicon.png'), apple: withBasePath('/icon.png') },
};

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ lang?: string }> }) {
  const { lang } = await params;
  return (
    <html lang={lang ?? i18n.defaultLanguage} className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
