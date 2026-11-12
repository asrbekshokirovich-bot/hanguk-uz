import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = { user: null as { id: string } | null, loading: false };
const role = { isAdmin: false, loading: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role }));

import { AdminRoute } from '../AdminRoute';

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const open = () =>
  render(
    <MemoryRouter initialEntries={['/system-map']}>
      <Routes>
        <Route path="/system-map" element={<AdminRoute><div>the map</div></AdminRoute>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.user = null;
  auth.loading = false;
  role.isAdmin = false;
  role.loading = false;
});

describe('AdminRoute', () => {
  it('a visitor is sent to the sign-in page and never sees the page', () => {
    open();
    expect(screen.queryByText('the map')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/auth');
  });

  it('a signed-in student or operator is sent home', () => {
    auth.user = { id: 'u1' };
    open();
    expect(screen.queryByText('the map')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('nothing is shown while the role is still being read', () => {
    auth.user = { id: 'u1' };
    role.loading = true;
    open();
    expect(screen.queryByText('the map')).toBeNull();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('an owner or admin sees the page', () => {
    auth.user = { id: 'u1' };
    role.isAdmin = true;
    open();
    expect(screen.getByText('the map')).toBeTruthy();
  });
});
