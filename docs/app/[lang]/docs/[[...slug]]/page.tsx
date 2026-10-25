import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Monitor, Router, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ComponentProps } from 'react';
import { source } from '@/lib/source';

type Params = { params: Promise<{ lang: string; slug?: string[] }> };

export default async function Page({ params }: Params) {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();
  const MDX = page.data.body;
  // page.path carries the locale ("ru/openwrt/x.mdx") but the page index does not, which is
  // why fumadocs' createRelativeLink misses; resolve ./x.mdx links against the bare directory.
  const dir = page.path.split('/').slice(1, -1).join('/');
  const resolve = (href?: string) => {
    if (!href || !(href.startsWith('./') || href.startsWith('../'))) return href;
    const target = source.getPageByHref(href, { dir, language: lang });
    return target ? target.page.url + (target.hash ? `#${target.hash}` : '') : href;
  };
  const Link = defaultMdxComponents.a;
  const LocalLink = ({ href, ...props }: ComponentProps<'a'>) => <Link href={resolve(href)} {...props} />;
  const LocalCard = ({ href, ...props }: ComponentProps<typeof Card>) => <Card href={resolve(href)} {...props} />;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: LocalLink,
            Card: LocalCard,
            Cards,
            Tab,
            Tabs,
            Smartphone,
            Monitor,
            Router,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
