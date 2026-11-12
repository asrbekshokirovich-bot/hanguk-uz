import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const role = { isInvestor: false, isStaff: false, loading: false };
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role }));
const registerServiceWorker = vi.fn();
vi.mock('@/lib/serviceWorker', () => ({ registerServiceWorker: () => registerServiceWorker() }));
vi.mock('@/contexts/IntakeContext', () => ({ IntakeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../CRMPortal', () => ({ default: () => <div>crm</div> }));
vi.mock('../investor/InvestorPortal', () => ({ default: () => <div>investor</div> }));

import CRMEntry from '../CRMEntry';

beforeEach(() => {
  role.isInvestor = false;
  role.isStaff = false;
  role.loading = false;
  registerServiceWorker.mockReset();
});

describe('CRMEntry — who gets the service worker', () => {
  it('staff: registered once the role is known', async () => {
    role.loading = true;
    const view = render(<CRMEntry />);
    expect(registerServiceWorker).not.toHaveBeenCalled();
    role.loading = false;
    role.isStaff = true;
    view.rerender(<CRMEntry />);
    await screen.findByText('crm');
    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
    view.rerender(<CRMEntry />);
    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('the investor: registered too', async () => {
    role.isInvestor = true;
    render(<CRMEntry />);
    await screen.findByText('investor');
    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('somebody who is neither (a student who typed /crm, a visitor): not registered', async () => {
    render(<CRMEntry />);
    await screen.findByText('crm');
    expect(registerServiceWorker).not.toHaveBeenCalled();
  });
});
