import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { getStudentActiveIntakeId } from '@/lib/studentIntake';

type DocumentRow = Tables<'documents'>;

const BUCKET = 'student-documents';

/**
 * Upload a file into a student's slot on their behalf, replacing whatever was
 * there. Writes the same shape the student portal does — `[slotId]` tag in
 * `name`, `slotId-` filename prefix, the student's own folder — so the upload
 * is matched to its slot everywhere.
 *
 * The old row is removed first: documents_student_doc_type_unique allows one
 * row per student per slot tag.
 */
export async function uploadStudentDocument(
  studentId: string,
  slotId: string,
  file: File,
  existing?: DocumentRow,
): Promise<{ error: Error | null }> {
  let uploadedPath: string | null = null;
  try {
    if (existing) {
      const { error } = await deleteStudentDocument(existing);
      if (error) throw error;
    }

    const ext = file.name.split('.').pop();
    const filePath = `${studentId}/${slotId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    uploadedPath = filePath;

    const intakeId = await getStudentActiveIntakeId(studentId);
    const { error: dbError } = await supabase.from('documents').insert({
      student_id: studentId,
      name: `[${slotId}] ${file.name}`,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
      status: 'uploaded',
      ...(intakeId ? { intake_id: intakeId } : {}),
    });
    if (dbError) throw dbError;
    return { error: null };
  } catch (err) {
    // The file landed but the row did not — don't leave an orphan behind.
    if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
    return { error: err instanceof Error ? err : new Error(String((err as { message?: string })?.message ?? err)) };
  }
}

/** Remove a document row and its file. A storage failure doesn't block the row. */
export async function deleteStudentDocument(doc: DocumentRow): Promise<{ error: Error | null }> {
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  return { error: error ? new Error(error.message) : null };
}

/** Open a student's document in a new tab. */
export async function openStudentDocument(doc: DocumentRow): Promise<{ error: Error | null }> {
  // Opened before the download so the browser treats it as the click's popup.
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(BUCKET).download(doc.file_path);
  if (error || !data) {
    win?.close();
    return { error: new Error(error?.message ?? 'Hujjat topilmadi') };
  }
  const url = URL.createObjectURL(data);
  if (win) {
    win.location.href = url;
  } else {
    // Popup blocked — download instead of navigating the CRM away.
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name.replace(/^\[.*?\]\s*/, '') || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { error: null };
}
