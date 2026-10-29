import { describe, expect, it } from 'vitest';
import { isHiddenMessage } from '../hiddenMessages';

describe('isHiddenMessage', () => {
  it('hides an empty Instagram card', () => {
    expect(isHiddenMessage({ source: 'instagram', content: '[template]' })).toBe(true);
  });
  it('keeps everything else', () => {
    expect(isHiddenMessage({ source: 'instagram', content: "Rahmat! Operatorlarimiz tez orada siz bilan bog'lanadi." })).toBe(false);
    expect(isHiddenMessage({ source: 'telegram', content: '[template]' })).toBe(false);
    expect(isHiddenMessage({ source: 'instagram', content: '[image] https://x' })).toBe(false);
  });
});
