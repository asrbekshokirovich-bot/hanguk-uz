import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import DocumentsContent from '../DocumentsContent';
import { deleteStudentDocument, uploadStudentDocument } from '@/lib/staffDocumentActions';

vi.mock('@/lib/staffDocumentActions', () => ({
  uploadStudentDocument: vi.fn().mockResolvedValue({ error: null }),
  deleteStudentDocument: vi.fn().mockResolvedValue({ error: null }),
  openStudentDocument: vi.fn().mockResolvedValue({ error: null }),
}));

/**
 * The Hujjatlar page used to check uploads against six invented slot ids, so a
 * student with seven real uploads showed 0/6 and every row said "missing".
 * This pins the page to the tags the student portal really writes.
 */
type Student = ComponentProps<typeof DocumentsContent>['students'][number];

let seq = 0;
const doc = (slot: string, file: string, status = 'uploaded'): Tables<'documents'> => {
  seq += 1;
  const at = new Date(Date.UTC(2026, 8, 16, 10, seq)).toISOString();
  return {
    id: `doc-${slot}`,
    student_id: 'u1',
    application_id: null,
    intake_id: 'i1',
    name: `[${slot}] ${file}`,
    file_path: `u1/${slot}-1758000000000-abc.pdf`,
    file_type: 'application/pdf',
    file_size: 1,
    status,
    notes: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: at,
    updated_at: at,
  } as Tables<'documents'>;
};

const student = {
  user_id: 'u1',
  full_name: 'ABDIRAIMOV XURSHID MULKOMA UGLI',
  magic_code: 'VHK3DAUB',
  avatar_url: null,
  contract_date: null,
  applications: [],
  documents: [
    doc('applicant_id_card', 'ID PASSPORT.pdf'),
    doc('foreign_passport', 'ZAGRAN.pdf'),
    doc('mother_id_card', 'MATHER PASSPORT.pdf'),
    doc('birth_certificate', 'BIRTH.pdf'),
    doc('language_certificate', 'IELTS.pdf'),
    doc('photo', 'PHOTO.jpg'),
    doc('diploma', 'QR CODE.pdf'),
  ],
} as unknown as Student;

const setup = ({ canApprove = true }: { canApprove?: boolean } = {}) => {
  const onUpdateDocumentStatus = vi.fn().mockResolvedValue({ error: null });
  const onDocumentsChanged = vi.fn();
  render(
    <DocumentsContent
      students={[student]}
      loading={false}
      currentLang="uz"
      onUpdateDocumentStatus={onUpdateDocumentStatus}
      onUpdateApplicationStatus={vi.fn().mockResolvedValue({ error: null })}
      canApproveDocuments={canApprove}
      onDocumentsChanged={onDocumentsChanged}
    />,
  );
  return { onUpdateDocumentStatus, onDocumentsChanged };
};

describe('DocumentsContent application pack', () => {
  it('shows each real upload as received instead of missing', () => {
    setup({ canApprove: false });
    // Seven uploads awaiting review; five pack slots genuinely empty — the
    // father's ID card plus the four optional ones (marriage and death
    // certificates, TOPIK, diploma apostille) — and the five translations
    // (birth certificate, diploma, apostille, marriage and death certificates).
    expect(screen.getAllByText('Qabul qilindi')).toHaveLength(7);
    expect(screen.getAllByText("Yo'q")).toHaveLength(10);
    expect(screen.getAllByText('Talaba yuklashi kerak')).toHaveLength(5);
    expect(screen.getAllByText('Tarjima yuklanmagan')).toHaveLength(5);
    // The counter is over the 8 required slots only, so the optional three
    // never move it: one required slot empty still reads 0/8 verified.
    expect(screen.getAllByText('0/8').length).toBeGreaterThan(0);
    expect(screen.getByText('8 ta qoldi')).toBeInTheDocument();
    expect(screen.getAllByText('Ixtiyoriy')).toHaveLength(4);
    // Slots carry the portal's own wording, not the old English mock labels.
    expect(screen.getByText('Diplom yoki attestat nusxasi')).toBeInTheDocument();
    expect(screen.getByText('IELTS sertifikati nusxasi')).toBeInTheDocument();
    expect(screen.queryByText('Til sertifikat nusxasi')).not.toBeInTheDocument();
    expect(screen.getByText("O'lim guvohnomasi nusxasi")).toBeInTheDocument();
    for (const label of ["Tug'ilganlik guvohnomasi tarjimasi", 'Diplom / attestat tarjimasi', 'Apostil tarjimasi', "O'lim guvohnomasi tarjimasi"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Passport copy')).not.toBeInTheDocument();
    // The dead "mark as received" button (it only raised a toast) is gone.
    expect(screen.queryByText('Qabul qilindi deb belgilash')).not.toBeInTheDocument();
  });

  it('verifies the matched document row', async () => {
    const { onUpdateDocumentStatus } = setup();
    fireEvent.click(screen.getAllByText('Tarjimaga')[0]);
    await waitFor(() => expect(onUpdateDocumentStatus).toHaveBeenCalledWith('doc-applicant_id_card', 'approved'));
  });

  it('lets only an approver verify, upload, replace or delete', () => {
    setup({ canApprove: false });
    expect(screen.queryByText('Tarjimaga')).not.toBeInTheDocument();
    expect(screen.queryByText("Qayta so'rash")).not.toBeInTheDocument();
    expect(screen.queryByText('Yuklash')).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText('Almashtirish')).toHaveLength(0);
    expect(screen.queryAllByLabelText("O'chirish")).toHaveLength(0);
    expect(screen.getAllByText('Tasdiqlash kutilmoqda')).toHaveLength(7);
    // Viewing stays open to every staff role.
    expect(screen.getAllByLabelText("Ko'rish")).toHaveLength(7);
  });

  it('uploads into an empty slot as an approver', async () => {
    const { onDocumentsChanged } = setup();
    // Ten empty rows: five pack slots and five translations.
    expect(screen.getAllByText('Yuklash')).toHaveLength(10);
    fireEvent.click(screen.getAllByText('Yuklash')[0]);
    const file = new File(['x'], 'FATHER.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('approver-doc-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(uploadStudentDocument).toHaveBeenCalledWith('u1', 'father_id_card', file, undefined));
    await waitFor(() => expect(onDocumentsChanged).toHaveBeenCalled());
  });

  it('replaces an uploaded document as an approver', async () => {
    setup();
    fireEvent.click(screen.getAllByLabelText('Almashtirish')[0]);
    const file = new File(['x'], 'NEW.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('approver-doc-file-input'), { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadStudentDocument).toHaveBeenCalledWith('u1', 'applicant_id_card', file, expect.objectContaining({ id: 'doc-applicant_id_card' })),
    );
  });

  it('deletes an uploaded document after confirmation', async () => {
    const { onDocumentsChanged } = setup();
    fireEvent.click(screen.getAllByLabelText("O'chirish")[0]);
    fireEvent.click(await screen.findByText("Ha, o'chirish"));
    await waitFor(() => expect(deleteStudentDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-applicant_id_card' })));
    await waitFor(() => expect(onDocumentsChanged).toHaveBeenCalled());
  });

  it('tints a contracted card amber until paid, green after, with no status label', () => {
    const mk = (id: string, name: string, contract_date: string | null, hasPaid: boolean) =>
      ({ ...student, user_id: id, full_name: name, contract_date, hasPaid, documents: [] }) as unknown as Student;
    render(
      <DocumentsContent
        students={[mk('a', 'PAID ONE', '2026-10-01', true), mk('b', 'UNPAID ONE', '2026-10-01', false), mk('c', 'LEAD ONE', null, false)]}
        loading={false}
        currentLang="uz"
        onUpdateDocumentStatus={vi.fn().mockResolvedValue({ error: null })}
      />,
    );
    const tintOf = (name: string) => screen.getAllByText(name)[0].closest('[data-tint]')?.getAttribute('data-tint');
    expect(tintOf('PAID ONE')).toBe('paid');
    expect(tintOf('UNPAID ONE')).toBe('unpaid');
    expect(tintOf('LEAD ONE')).toBe('none');
    expect(screen.queryByText(/To'lov kutilmoqda|To'lov kechikdi|To'langan/)).not.toBeInTheDocument();
  });

  it('describes uploads as uploaded, not accepted, in the history', () => {
    setup();
    expect(screen.getByText('"[diploma] QR CODE.pdf" hujjati yuklandi')).toBeInTheDocument();
    expect(screen.queryByText(/hujjati qabul qilindi/)).not.toBeInTheDocument();
  });
});
