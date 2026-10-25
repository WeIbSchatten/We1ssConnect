import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// DEPLOY_TARGET=static builds the GitHub Pages export. Pages serves the project site under
// /<repo>/, so basePath is the path of the site URL (empty for a custom domain).
const isStaticExport = process.env.DEPLOY_TARGET === 'static';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://weibschatten.github.io/We1ssConnect';
const basePath = isStaticExport ? new URL(siteUrl).pathname.replace(/\/+$/, '') : '';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The app's package-lock.json one level up is not this site's workspace root.
  turbopack: { root: import.meta.dirname },
  basePath,
  // next/link applies basePath itself; plain src/href strings go through withBasePath.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isStaticExport ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default withMDX(config);
