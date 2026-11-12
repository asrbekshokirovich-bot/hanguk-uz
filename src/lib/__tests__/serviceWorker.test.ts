import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../serviceWorker';

const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
const install = (value: unknown) => Object.defineProperty(navigator, 'serviceWorker', { value, configurable: true });

afterEach(() => {
  if (original) Object.defineProperty(navigator, 'serviceWorker', original);
  else delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  vi.restoreAllMocks();
});

describe('registerServiceWorker', () => {
  it('registers /sw.js for the whole site in production', () => {
    const register = vi.fn().mockResolvedValue({});
    install({ register });
    expect(registerServiceWorker({ prod: true })).toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('does nothing in development and in tests — there is no worker there', () => {
    const register = vi.fn().mockResolvedValue({});
    install({ register });
    expect(registerServiceWorker({ prod: false })).toBe(false);
    expect(registerServiceWorker()).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('a browser without service workers is left alone', () => {
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    expect(registerServiceWorker({ prod: true })).toBe(false);
  });

  it('a failed registration is not an error of the page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    install({ register: vi.fn().mockRejectedValue(new Error('blocked')) });
    expect(registerServiceWorker({ prod: true })).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
  });
});
