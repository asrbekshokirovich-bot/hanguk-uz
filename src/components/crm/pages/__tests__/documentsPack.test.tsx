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

const setup = () => {
  const onUpdateDocumentStatus = vi.fn().mockResolvedValue({ error: null });
  render(
    <DocumentsContent
      students={[student]}
      loading={false}
      currentLang="uz"
      onUpdateDocumentStatus={onUpdateDocumentStatus}
      onUpdateApplicationStatus={vi.fn().mockResolvedValue({ error: null })}
    />,
  );
  return { onUpdateDocumentStatus };
};

describe('DocumentsContent application pack', () => {
  it('shows each real upload as received instead of missing', () => {
    setup();
    // Seven uploads awaiting review, two required slots genuinely empty.
    expect(screen.getAllByText('Qabul qilindi')).toHaveLength(7);
    expect(screen.getAllByText("Yo'q")).toHaveLength(2);
    expect(screen.getAllByText('Talaba yuklashi kerak')).toHaveLength(2);
    // The counter is over the 8 required slots; the marriage certificate is optional.
    expect(screen.getAllByText('0/8').length).toBeGreaterThan(0);
    expect(screen.getByText('8 ta qoldi')).toBeInTheDocument();
    expect(screen.getByText('Ixtiyoriy')).toBeInTheDocument();
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

  it('describes uploads as uploaded, not accepted, in the history', () => {
    setup();
    expect(screen.getByText('"[diploma] QR CODE.pdf" hujjati yuklandi')).toBeInTheDocument();
    expect(screen.queryByText(/hujjati qabul qilindi/)).not.toBeInTheDocument();
  });
});
