import { describe, expect, it } from 'vitest';
import { androidIntent, appUri, deviceOf, linkCode, operatorLink, playUrl, webUrl } from '../appLink';

describe('operator link to the app', () => {
  it('takes only what can be a link code', () => {
    expect(linkCode('ABC1234567')).toBe('abc1234567');
    expect(linkCode(' abc123 ')).toBe('abc123');
    expect(linkCode('abc')).toBeNull();
    expect(linkCode('abc-1234567')).toBeNull();
    expect(linkCode(undefined)).toBeNull();
  });

  it('builds the app, Play, Android and web addresses with the code', () => {
    expect(appUri('abc1234567')).toBe('hanguk://open/l/abc1234567');
    expect(playUrl('abc1234567')).toBe(
      'https://play.google.com/store/apps/details?id=com.hanguk.studentapp.hanguk_app&referrer=l%3Dabc1234567',
    );
    expect(playUrl(null)).toBe('https://play.google.com/store/apps/details?id=com.hanguk.studentapp.hanguk_app');
    const intent = androidIntent('abc1234567');
    expect(intent.startsWith('intent://open/l/abc1234567#Intent;scheme=hanguk;package=com.hanguk.studentapp.hanguk_app;')).toBe(true);
    expect(decodeURIComponent(intent.split('S.browser_fallback_url=')[1].replace(';end', ''))).toBe(playUrl('abc1234567'));
    expect(new URL(webUrl('abc1234567')).searchParams.get('l')).toBe('abc1234567');
    expect(operatorLink('abc1234567')).toBe('https://hanguk.uz/l/abc1234567');
  });

  it('tells the phone apart', () => {
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; SM-A515F)')).toBe('android');
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0)')).toBe('other');
  });
});
