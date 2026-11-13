import Constants from 'expo-constants';
import XrayVpn from 'xray-vpn';

export interface Fetched {
  status: number;
  body: string;
  header(name: string): string | null;
}

export const userAgent = () => `We1ssConnect/${Constants.expoConfig?.version ?? '0'}`;

/** The subscription server's root for the portal API, from whatever form the user typed. */
export function portalBase(input: string): string {
  let value = input.trim();
  if (!value) throw new Error('empty address');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, '').replace(/\/portal$/i, '').replace(/\/+$/, '');
  return value;
}

// The desktop webview cannot reach most servers (CORS), so Go makes the request there.
export async function request(
  method: string,
  url: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<Fetched> {
  const headers = { Accept: '*/*', ...opts.headers };
  if (XrayVpn.request) {
    const r = await XrayVpn.request(method, url, userAgent(), headers, opts.body ?? '');
    return { status: r.status, body: r.body, header: (name) => r.headers[name.toLowerCase()] ?? null };
  }
  const res = await fetch(url, { method, headers: { 'User-Agent': userAgent(), ...headers }, body: opts.body });
  return { status: res.status, body: await res.text(), header: (name) => res.headers.get(name) };
}
