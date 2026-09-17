import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import DocumentsContent from '../DocumentsContent';

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

const setup = (students: Student[] = [student]) => {
  const onUpdateDocumentStatus = vi.fn().mockResolvedValue({ error: null });
  const onUploadDocument = vi.fn().mockResolvedValue({ error: null });
  render(
    <DocumentsContent
      students={students}
      loading={false}
      currentLang="uz"
      onUpdateDocumentStatus={onUpdateDocumentStatus}
      onUploadDocument={onUploadDocument}
      onUpdateApplicationStatus={vi.fn().mockResolvedValue({ error: null })}
    />,
  );
  return { onUpdateDocumentStatus, onUploadDocument };
};

describe('DocumentsContent application pack', () => {
  it('shows each real upload as received instead of missing', () => {
    setup();
    // Seven uploads awaiting review; the father's ID, the marriage certificate
    // and the staff-only TOPIK slot are empty, but only the first two are on
    // the student to upload.
    expect(screen.getAllByText('Qabul qilindi')).toHaveLength(7);
    expect(screen.getAllByText("Yo'q")).toHaveLength(3);
    expect(screen.getAllByText('Talaba yuklashi kerak')).toHaveLength(2);
    // The counter is over the 8 required slots; the marriage and TOPIK
    // certificates are optional.
    expect(screen.getAllByText('0/8').length).toBeGreaterThan(0);
    expect(screen.getByText('8 ta qoldi')).toBeInTheDocument();
    expect(screen.getAllByText('Ixtiyoriy')).toHaveLength(2);
    // Slots carry the portal's own wording, not the old English mock labels.
    expect(screen.getByText('Diplom yoki attestat nusxasi')).toBeInTheDocument();
    expect(screen.queryByText('Passport copy')).not.toBeInTheDocument();
    // The dead "mark as received" button (it only raised a toast) is gone.
    expect(screen.queryByText('Qabul qilindi deb belgilash')).not.toBeInTheDocument();
  });

  it('verifies the matched document row', async () => {
    const { onUpdateDocumentStatus } = setup();
    fireEvent.click(screen.getAllByText('Tarjimaga')[0]);
    await waitFor(() => expect(onUpdateDocumentStatus).toHaveBeenCalledWith('doc-applicant_id_card', 'approved'));
  });

  it('lets staff upload the TOPIK certificate into its own slot', async () => {
    const { onUploadDocument } = setup();
    expect(screen.getByText('TOPIK sertifikati nusxasi')).toBeInTheDocument();
    // The only upload control on the page belongs to the TOPIK row.
    fireEvent.click(screen.getByText('Yuklash'));
    const file = new File(['topik'], 'TOPIK 4.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Hujjat faylini tanlash'), { target: { files: [file] } });
    await waitFor(() => expect(onUploadDocument).toHaveBeenCalledWith('u1', 'topik_certificate', file));
  });

  it('removes a staff-uploaded TOPIK certificate instead of asking the student again', async () => {
    const withTopik = {
      ...student,
      documents: [...(student as unknown as { documents: Tables<'documents'>[] }).documents, doc('topik_certificate', 'TOPIK.pdf')],
    } as unknown as Student;
    const { onUpdateDocumentStatus } = setup([withTopik]);
    // Received like any other upload, but its reset action is a plain delete.
    expect(screen.getAllByText('Qabul qilindi')).toHaveLength(8);
    expect(screen.queryByText('Yuklash')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("O'chirish"));
    await waitFor(() => expect(onUpdateDocumentStatus).toHaveBeenCalledWith('doc-topik_certificate', 'rejected'));
  });

  it('describes uploads as uploaded, not accepted, in the history', () => {
    setup();
    expect(screen.getByText('"[diploma] QR CODE.pdf" hujjati yuklandi')).toBeInTheDocument();
    expect(screen.queryByText(/hujjati qabul qilindi/)).not.toBeInTheDocument();
  });
});
