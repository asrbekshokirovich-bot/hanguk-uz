import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => upload(...args),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
      }),
    },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { FeeReceiptUpload } from '../FeeReceiptUpload';

const file = (name: string, type = 'image/jpeg') => new File(['x'], name, { type });

describe('FeeReceiptUpload', () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
  });

  it("bir vaqtda bir nechta chek yuklaydi va ro'yxatga qo'shadi", async () => {
    const onChange = vi.fn();
    render(<FeeReceiptUpload value={[]} onChange={onChange} studentId="s1" />);
    const input = screen.getByTestId('fee-receipt-input') as HTMLInputElement;
    expect(input.multiple).toBe(true);

    fireEvent.change(input, { target: { files: [file('a.jpg'), file('b.pdf', 'application/pdf')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const list = onChange.mock.calls[0][0];
    expect(list).toHaveLength(2);
    expect(list.map((r: { fileName: string }) => r.fileName)).toEqual(['a.jpg', 'b.pdf']);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("mavjud chekka yangisini qo'shadi, o'rniga yozmaydi", async () => {
    const onChange = vi.fn();
    const existing = [{ url: 'https://cdn/old.jpg', fileName: 'old.jpg' }];
    render(<FeeReceiptUpload value={existing} onChange={onChange} studentId="s1" />);
    expect(screen.getByText("Yana chek qo'shish")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('fee-receipt-input'), { target: { files: [file('new.jpg')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].map((r: { fileName: string }) => r.fileName)).toEqual(['old.jpg', 'new.jpg']);
  });

  it("har bir chekni alohida olib tashlaydi", () => {
    const onChange = vi.fn();
    const value = [
      { url: 'https://cdn/1.jpg', fileName: '1.jpg' },
      { url: 'https://cdn/2.jpg', fileName: '2.jpg' },
    ];
    render(<FeeReceiptUpload value={value} onChange={onChange} studentId="s1" />);
    expect(screen.getByText('1-chek')).toBeInTheDocument();
    expect(screen.getByText('2-chek')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('1-chekni olib tashlash'));
    expect(onChange).toHaveBeenCalledWith([value[1]]);
  });

  it("noto'g'ri turdagi faylni yuklamaydi", async () => {
    const onChange = vi.fn();
    render(<FeeReceiptUpload value={[]} onChange={onChange} studentId="s1" />);
    fireEvent.change(screen.getByTestId('fee-receipt-input'), { target: { files: [file('a.txt', 'text/plain')] } });
    await waitFor(() => expect(upload).not.toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
