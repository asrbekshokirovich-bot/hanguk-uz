import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

type HeaderRule = { source: string; headers: { key: string; value: string }[] };
const vercel = JSON.parse(read('vercel.json')) as { headers: HeaderRule[] };
const covers = (rule: HeaderRule, path: string) => new RegExp(`^${rule.source}$`).test(path);

describe('vercel.json — security headers', () => {
  const rule = vercel.headers[0];
  const header = (key: string) => rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

  it('the site and the CRM cannot be framed by another site', () => {
    expect(header('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(header('Content-Security-Policy')).toBe("frame-ancestors 'self'");
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('covers every page of this site', () => {
    for (const path of ['/', '/auth', '/crm', '/crm/leads', '/app', '/privacy', '/l/abc123', '/assets/index-abc.js']) {
      expect(covers(rule, path), path).toBe(true);
    }
  });

  it('leaves the student web app (another Vercel project, proxied) alone', () => {
    // Its phone frame embeds the app in an iframe and asks for the camera and
    // the microphone: its headers are its own.
    for (const path of ['/ilova/', '/ilova/app/', '/ilova/app/main.dart.js']) {
      expect(covers(rule, path), path).toBe(false);
    }
  });
});

describe('robots.txt and sitemap.xml', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);

  it('robots.txt points at the sitemap and keeps the CRM out of search', () => {
    expect(robots).toMatch(/^Sitemap: https:\/\/www\.hanguk\.uz\/sitemap\.xml$/m);
    expect(disallowed).toEqual(expect.arrayContaining(['/crm', '/portal', '/system-map']));
    // One group for everyone: a crawler with a group of its own would skip the rest.
    expect(robots.match(/^User-agent:/gm)).toHaveLength(1);
  });

  it('the sitemap lists public pages only, on the address the site answers at', () => {
    expect(urls.length).toBeGreaterThan(3);
    for (const url of urls) {
      expect(url.startsWith('https://www.hanguk.uz/'), url).toBe(true);
      const path = new URL(url).pathname;
      expect(disallowed.some((d) => path === d || path.startsWith(`${d}/`)), url).toBe(false);
    }
    expect(urls).toContain('https://www.hanguk.uz/');
    expect(urls).toContain('https://www.hanguk.uz/app');
  });
});
