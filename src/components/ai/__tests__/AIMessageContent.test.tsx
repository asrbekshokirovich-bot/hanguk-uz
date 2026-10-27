import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIMessageContent } from '@/components/ai/AIMessageContent';

describe('AIMessageContent', () => {
  it('shows bold and lists formatted, not as raw ** marks', () => {
    const { container } = render(<AIMessageContent content={'**Jami:** 12 ta\n\n1. ABDIRAIMOV\n2. HAMZAYEV'} />);
    expect(container.querySelector('strong')?.textContent).toBe('Jami:');
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
    expect(container.textContent).not.toContain('**');
  });

  it('still renders a clarify question as buttons', () => {
    render(<AIMessageContent content={'{"type":"clarify","question":"Qaysi?","options":["A","B"]}'} />);
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy();
  });
});
