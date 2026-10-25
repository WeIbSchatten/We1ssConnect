import Link from 'next/link';
import { ArrowRight, Download, Gauge, Globe, Layers, Route, ShieldCheck, Zap, type LucideIcon } from 'lucide-react';
import { CopyCommand } from '@/components/copy-command';
import { Mark } from '@/components/mark';
import { i18n, localePrefix } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { appName, openwrtInstall, panelDocsUrl, releasesUrl } from '@/lib/shared';

const ICONS: LucideIcon[] = [Layers, Zap, Route, Globe, Gauge, ShieldCheck];

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const prefix = localePrefix(lang);
  const m = messages(lang);
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-20 text-center sm:py-24">
          <Mark className="h-16 sm:h-20" />
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">{appName}</h1>
          <p className="mt-4 max-w-2xl text-lg text-fd-muted-foreground">{m.tagline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={releasesUrl} className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-5 py-3 font-medium text-fd-primary-foreground hover:opacity-90">
              <Download className="size-4" />
              {m.download}
            </a>
            <Link href={`${prefix}/docs`} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 font-medium hover:bg-fd-accent">
              {m.getStarted}
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-10 w-full max-w-2xl text-start">
            <p className="mb-2 text-sm font-medium">{m.routerTitle}</p>
            <p className="mb-3 text-sm text-fd-muted-foreground">{m.routerText}</p>
            <CopyCommand command={openwrtInstall} copy={m.copy} copied={m.copied} />
          </div>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {m.features.map(([title, text], i) => {
          const Icon = ICONS[i];
          return (
            <div key={title} className="rounded-2xl border bg-fd-card p-6">
              <Icon className="size-6" aria-hidden />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-fd-muted-foreground">{text}</p>
            </div>
          );
        })}
      </section>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-fd-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Mark className="h-5" /> {appName}
          </span>
          <nav className="flex gap-4">
            <Link href={`${prefix}/docs`} className="hover:text-fd-foreground">{m.documentation}</Link>
            <a href={`${panelDocsUrl}${prefix}/docs`} className="hover:text-fd-foreground">{m.panelDocs}</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
