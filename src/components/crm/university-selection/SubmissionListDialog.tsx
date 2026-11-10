import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { submissionCsv, type SubmissionRow } from '@/lib/submissionList';

/** All active students' chosen universities and faculties, with a CSV download. */
export function SubmissionListDialog({
  open,
  onOpenChange,
  rows,
  onOpenStudent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: SubmissionRow[];
  onOpenStudent: (studentId: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.student, r.university, r.faculty].some((v) => v?.toLowerCase().includes(s)));
  }, [rows, q]);
  const withFaculty = rows.filter((r) => r.faculty).length;

  const download = () => {
    const blob = new Blob([submissionCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topshirish-royxati-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Topshirish ro'yxati</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {rows.length} ta tanlov · fakulteti kiritilgan: {withFaculty} · kiritilmagan: {rows.length - withFaculty}
          </p>
        </DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="Talaba, universitet yoki fakultet" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="outline" className="gap-1" onClick={download} disabled={shown.length === 0}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talaba</TableHead>
                <TableHead className="w-10">№</TableHead>
                <TableHead>Universitet</TableHead>
                <TableHead>Fakultet</TableHead>
                <TableHead>Holat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r, i) => (
                <TableRow key={`${r.studentId}-${r.rank}-${i}`}>
                  <TableCell>
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => onOpenStudent(r.studentId)}>
                      {r.student}
                    </button>
                  </TableCell>
                  <TableCell>{r.rank}</TableCell>
                  <TableCell>{r.university}</TableCell>
                  <TableCell>
                    {r.faculty ? (
                      <>
                        <div>{r.faculty}</div>
                        {r.college && <div className="text-xs text-muted-foreground">{r.college}</div>}
                      </>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-500">Kiritilmagan</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{r.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
