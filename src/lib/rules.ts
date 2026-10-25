// The user's own routing entries, in Xray's spelling: geosite:/geoip: categories of the rule
// files, domain:/full:/keyword:/regexp: domains, plain domains, IP addresses and subnets.

export interface CustomRules {
  /** Through the VPN even when a direct rule or preset would match. */
  proxy: string[];
  direct: string[];
  block: string[];
}

export const EMPTY_RULES: CustomRules = { proxy: [], direct: [], block: [] };

const CATEGORY = /^[a-z0-9][a-z0-9._!-]*$/;
const DOMAIN = /^([a-z0-9-]+\.)+[a-z0-9-]+$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/;
const IPV6 = /^[0-9a-f:]*:[0-9a-f:.]*(\/\d{1,3})?$/i;

function isIpv4(s: string): boolean {
  const m = IPV4.exec(s);
  return !!m && m.slice(1, 5).every((o) => Number(o) <= 255) && (!m[6] || Number(m[6]) <= 32);
}

export interface Parsed {
  domain: string[];
  ip: string[];
  invalid: string[];
}

export function parseEntries(lines: string[]): Parsed {
  const out: Parsed = { domain: [], ip: [], invalid: [] };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const lower = line.toLowerCase();
    const prefix = lower.slice(0, lower.indexOf(':') + 1);
    // Attributes such as geosite:google@cn are not in the published rule-sets the router uses.
    if (prefix === 'geosite:' || prefix === 'geoip:') {
      const name = lower.slice(prefix.length);
      if (CATEGORY.test(name)) (prefix === 'geosite:' ? out.domain : out.ip).push(prefix + name);
      else out.invalid.push(line);
    } else if (['domain:', 'full:', 'keyword:', 'regexp:'].includes(prefix) && line.length > prefix.length) {
      out.domain.push(prefix + line.slice(prefix.length));
    } else if (isIpv4(line) || (IPV6.test(line) && line.includes(':'))) {
      out.ip.push(line);
    } else if (/^[\d./]+$/.test(line)) {
      out.invalid.push(line);
    } else if (DOMAIN.test(lower.replace(/^\*\./, ''))) {
      out.domain.push('domain:' + lower.replace(/^\*\./, ''));
    } else {
      out.invalid.push(line);
    }
  }
  return out;
}

export function usesGeo(rules: CustomRules): boolean {
  return [...rules.proxy, ...rules.direct, ...rules.block].some((e) => /^\s*geo(site|ip):/i.test(e));
}

export function describeEntries(entries: string[]): string {
  const shown = entries.slice(0, 3).join(', ');
  return entries.length > 3 ? `${shown} +${entries.length - 3}` : shown;
}
