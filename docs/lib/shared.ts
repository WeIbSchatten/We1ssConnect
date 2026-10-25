export const appName = 'We1ssConnect';
export const docsRoute = '/docs';

export const repoUrl = 'https://github.com/WeIbSchatten/We1ssConnect';
export const releasesUrl = `${repoUrl}/releases/latest`;

// The panel's documentation; both sites link to each other.
export const panelDocsUrl = 'https://weibschatten.github.io/We1ssBoard';

export const openwrtInstall =
  'wget -qO- https://raw.githubusercontent.com/WeIbSchatten/We1ssConnect/main/openwrt/install.sh | sh';

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://weibschatten.github.io/We1ssConnect';

// Path prefix of the static export (e.g. "/We1ssConnect"), set in next.config.mjs.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  return `${basePath}${path}`;
}
