import { describe, expect, it } from 'vitest';
import { safeInternalPath } from '../safePath';

const ORIGIN = 'https://www.hanguk.uz';

describe('safeInternalPath', () => {
  it('keeps a path on this site, with its query and hash', () => {
    expect(safeInternalPath('/surveys', ORIGIN)).toBe('/surveys');
    expect(safeInternalPath('/surveys/7f3c?from=tg#q2', ORIGIN)).toBe('/surveys/7f3c?from=tg#q2');
    expect(safeInternalPath('/crm?intake=spring-2027', ORIGIN)).toBe('/crm?intake=spring-2027');
  });

  it('keeps a path whose query merely mentions another site', () => {
    expect(safeInternalPath('/ok?x=//evil.example', ORIGIN)).toBe('/ok?x=//evil.example');
  });

  it('refuses another site, however it is spelled', () => {
    for (const raw of [
      '//evil.example/x',
      '/\\evil.example/x',
      '/\\/evil.example/x',
      '\\\\evil.example/x',
      '/\t/evil.example/x',
      '/\n/evil.example/x',
      '/\r\n/evil.example/x',
      'https://evil.example/x',
      'javascript:alert(1)',
      'evil.example',
      ' /surveys',
    ]) {
      expect(safeInternalPath(raw, ORIGIN), JSON.stringify(raw)).toBeNull();
    }
  });

  it('refuses nothing at all', () => {
    expect(safeInternalPath(null, ORIGIN)).toBeNull();
    expect(safeInternalPath(undefined, ORIGIN)).toBeNull();
    expect(safeInternalPath('', ORIGIN)).toBeNull();
  });

  it('uses the page origin by default', () => {
    expect(safeInternalPath('/surveys')).toBe('/surveys');
    expect(safeInternalPath('/\\evil.example')).toBeNull();
  });
});
