import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LeadCardSheet from '../LeadCardSheet';
import './testUtils'; // shared timeouts

// the card itself is another module's job; this checks what the sheet hands it
const received = vi.hoisted(() => ({ props: [] as { leadId: string; className?: string; startCall?: boolean }[] }));
vi.mock('@/components/crm/lead-desk/card/LeadCard', () => ({
  default: (props: { leadId: string; onClose?: () => void; className?: string; startCall?: boolean }) => {
    received.props.push(props);
    return (
      <div data-testid="card">
        {props.leadId}
        <button onClick={props.onClose}>kartadan yopish</button>
      </div>
    );
  },
}));

describe('LeadCardSheet', () => {
  it('shows the card of the lead it is given', () => {
    render(<LeadCardSheet leadId="lead-42" onClose={vi.fn()} />);
    expect(screen.getByTestId('card')).toHaveTextContent('lead-42');
    expect(received.props[received.props.length - 1]).toMatchObject({ leadId: 'lead-42' });
  });

  it('shows nothing while no lead is picked', () => {
    render(<LeadCardSheet leadId={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });

  it('closes from the card, and with Escape', () => {
    const onClose = vi.fn();
    render(<LeadCardSheet leadId="lead-42" onClose={onClose} />);

    fireEvent.click(screen.getByText('kartadan yopish'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByTestId('card'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('is a labelled dialog for screen readers', () => {
    render(<LeadCardSheet leadId="lead-42" onClose={vi.fn()} />);
    expect(screen.getByText('Lid kartasi')).toBeInTheDocument();
  });
});
