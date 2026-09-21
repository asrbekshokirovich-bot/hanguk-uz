import { describe, it, expect } from 'vitest';
import type { Tables } from '@/integrations/supabase/types';
import { APPLICATION_PACK_SLOTS, buildApplicationPack } from '../studentDocSlots';

// Rows shaped like what the student portal really writes: the slot id goes
// into `name` as a `[slot]` tag and into the storage filename as a prefix.
let seq = 0;
const row = (slot: string, file: string, status = 'uploaded'): Tables<'documents'> => {
  seq += 1;
  const at = new Date(Date.UTC(2026, 8, 16, 10, seq)).toISOString();
  return {
    id: `doc-${seq}`,
    student_id: 'student-1',
    application_id: null,
    intake_id: 'intake-1',
    name: `[${slot}] ${file}`,
    file_path: `student-1/${slot}-1758000000000-abc123.${file.split('.').pop()}`,
    file_type: 'application/pdf',
    file_size: 1000,
    status,
    notes: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: at,
    updated_at: at,
  } as Tables<'documents'>;
};

const byId = (docs: Tables<'documents'>[]) =>
  Object.fromEntries(buildApplicationPack(docs).slots.map((s) => [s.slot.id, s]));

// The uploads from the report that started this: seven real documents the old
// hardcoded checklist (passport_copy, school_diploma, …) showed as all missing.
const uploads = [
  row('applicant_id_card', 'ID PASSPORT.pdf'),
  row('foreign_passport', 'ZAGRAN.pdf'),
  row('mother_id_card', 'MATHER PASSPORT.pdf'),
  row('birth_certificate', 'BIRTH.pdf'),
  row('language_certificate', 'IELTS.pdf'),
  row('photo', 'PHOTO.jpg'),
  row('diploma', 'QR CODE.pdf'),
];

describe('buildApplicationPack', () => {
  it('matches every upload under the tag the portal actually writes', () => {
    const slots = byId(uploads);
    for (const id of ['applicant_id_card', 'foreign_passport', 'mother_id_card', 'birth_certificate', 'language_certificate', 'photo', 'diploma']) {
      expect(slots[id].state, id).toBe('received');
      expect(slots[id].doc?.name).toContain(`[${id}]`);
    }
    expect(slots.father_id_card.state).toBe('missing');
    expect(slots.marriage_certificate.state).toBe('missing');
  });

  it('gates the pack on required slots only', () => {
    const pack = buildApplicationPack(uploads);
    expect(pack.requiredTotal).toBe(8);
    expect(pack.requiredVerified).toBe(0);

    const approved = uploads.map((d) => ({ ...d, status: 'approved' }));
    const complete = buildApplicationPack([...approved, row('father_id_card', 'FATHER.pdf', 'approved')]);
    // No marriage certificate uploaded, and the pack is still complete.
    expect(complete.requiredVerified).toBe(complete.requiredTotal);
  });

  it('does not let a supplement or a translation fill the diploma slot', () => {
    const slots = byId([
      row('diploma_supplement', 'ILOVA.pdf', 'approved'),
      row('diploma_translation', 'DIPLOMA_EN.pdf', 'approved'),
    ]);
    expect(slots.diploma.state).toBe('missing');
    // An uploaded conditional document is surfaced as its own row…
    expect(slots.diploma_supplement.state).toBe('verified');
    expect(slots.diploma_supplement.slot.required).toBe(false);
    // …translation outputs are not part of the pack.
    expect(slots.diploma_translation).toBeUndefined();
  });

  it('shows only the pack slots when nothing conditional was uploaded', () => {
    const pack = buildApplicationPack([]);
    expect(pack.slots.map((s) => s.slot.id)).toEqual(APPLICATION_PACK_SLOTS.map((s) => s.id));
    expect(pack.slots.every((s) => s.state === 'missing')).toBe(true);
  });

  it('carries TOPIK and the apostille in the pack without gating on them', () => {
    const ids = APPLICATION_PACK_SLOTS.map((s) => s.id);
    expect(ids).toContain('topik_certificate');
    expect(ids).toContain('diploma_apostille');

    const slots = byId([
      row('topik_certificate', 'TOPIK.pdf', 'approved'),
      row('diploma_apostille', 'APOSTILLE.pdf'),
    ]);
    expect(slots.topik_certificate.state).toBe('verified');
    expect(slots.diploma_apostille.state).toBe('received');

    // Neither may block "advance to the next stage" — the students already in
    // the system predate both slots.
    expect(slots.topik_certificate.slot.required).toBe(false);
    expect(slots.diploma_apostille.slot.required).toBe(false);
  });

  it('does not let the language certificate fill the TOPIK slot, or the diploma fill the apostille', () => {
    const slots = byId([row('language_certificate', 'IELTS.pdf'), row('diploma', 'DIPLOMA.pdf')]);
    expect(slots.topik_certificate.state).toBe('missing');
    expect(slots.diploma_apostille.state).toBe('missing');
    expect(slots.language_certificate.state).toBe('received');
  });

  it('accepts the legacy applicant_passport tag for the foreign passport slot', () => {
    expect(byId([row('applicant_passport', 'OLD.pdf')]).foreign_passport.state).toBe('received');
  });

  it('uses the newest upload when a slot was re-uploaded', () => {
    const older = row('photo', 'old.jpg', 'approved');
    const newer = row('photo', 'new.jpg');
    const slots = byId([newer, older]);
    expect(slots.photo.doc?.id).toBe(newer.id);
    expect(slots.photo.state).toBe('received');
  });
});
