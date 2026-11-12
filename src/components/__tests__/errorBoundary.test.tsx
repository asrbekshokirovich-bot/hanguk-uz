import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const reportClientError = vi.fn();
vi.mock('@/lib/errorReporter', () => ({ reportClientError: (...a: unknown[]) => reportClientError(...a) }));

let reloading = false;
vi.mock('@/lib/buildReload', () => ({ isReloadingForNewBuild: () => reloading }));

import i18n from '@/lib/i18n';
import { ErrorBoundary, RELOAD_GRACE_MS } from '../ErrorBoundary';

const Broken = (): JSX.Element => {
  throw new Error("Cannot read properties of undefined (reading 'map')");
};

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  reloading = false;
  reportClientError.mockReset();
  // React prints the error it caught; the test output does not need it.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => { await i18n.changeLanguage('uz'); });
});
afterEach(() => consoleError.mockRestore());

describe('ErrorBoundary', () => {
  it('shows the page as usual when nothing breaks', () => {
    render(<ErrorBoundary><p>Lidlar</p></ErrorBoundary>);
    expect(screen.getByText('Lidlar')).toBeInTheDocument();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('a page that falls over says so in the reader\'s language and is reported as a crash', () => {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByText('Nimadir xato ketdi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keshni tozalab, qayta yuklash' })).toBeInTheDocument();
    // What broke stays on the screen: it is what the person reads out to support.
    expect(screen.getByText(/Cannot read properties of undefined/)).toBeInTheDocument();

    expect(reportClientError).toHaveBeenCalledTimes(1);
    const [kind, error, extra] = reportClientError.mock.calls[0];
    expect(kind).toBe('crash');
    expect((error as Error).message).toContain("reading 'map'");
    expect((extra as { componentStack: string }).componentStack).toContain('Broken');
  });

  it('speaks Russian to someone working in Russian', async () => {
    await act(async () => { await i18n.changeLanguage('ru'); });
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Очистить кэш и перезагрузить' })).toBeInTheDocument();
  });

  it('a custom fallback is still reported', () => {
    render(<ErrorBoundary fallback={<p>Xarita ochilmadi</p>}><Broken /></ErrorBoundary>);
    expect(screen.getByText('Xarita ochilmadi')).toBeInTheDocument();
    expect(reportClientError).toHaveBeenCalledWith('crash', expect.any(Error), expect.anything());
  });

  describe('while the page reloads for a new build', () => {
    // After a deploy the old build's chunk is gone; the import resolves to
    // nothing and this is what React throws a moment before the reload.
    const StaleChunk = (): JSX.Element => {
      throw new TypeError("Cannot read properties of undefined (reading 'default')");
    };

    beforeEach(() => {
      reloading = true;
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('shows no error screen and reports nothing', () => {
      const { container } = render(<ErrorBoundary><StaleChunk /></ErrorBoundary>);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText('Nimadir xato ketdi')).not.toBeInTheDocument();
      expect(reportClientError).not.toHaveBeenCalled();
    });

    it('a custom fallback waits too', () => {
      const { container } = render(<ErrorBoundary fallback={<p>Xarita ochilmadi</p>}><StaleChunk /></ErrorBoundary>);
      expect(container).toBeEmptyDOMElement();
    });

    it('if the reload does not come, the error shows after all', () => {
      render(<ErrorBoundary><StaleChunk /></ErrorBoundary>);
      act(() => { vi.advanceTimersByTime(RELOAD_GRACE_MS - 1); });
      expect(screen.queryByText('Nimadir xato ketdi')).not.toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.getByText('Nimadir xato ketdi')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keshni tozalab, qayta yuklash' })).toBeInTheDocument();
    });
  });
});
