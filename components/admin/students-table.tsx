'use client';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setStudent } from '@/lib/storage/students-cache';
import type { Student } from '@/lib/types/school';

function nullish(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

export function StudentsTable({ students }: { students: Student[] }) {
  const router = useRouter();

  function handleRow(s: Student) {
    setStudent({
      ulid: s.uuid,
      matric_no: s.matric_no,
      firstname: s.firstname,
      lastname: s.lastname,
      inspectedAt: new Date().toISOString(),
    });
    router.push(`/admin/students/${s.uuid}`);
  }

  if (students.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No students found.</p>;
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-2">Matric</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Department</th>
            <th className="px-4 py-2">Program</th>
            <th className="px-4 py-2">Level</th>
            <th className="px-4 py-2 text-right">View</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr
              key={s.uuid}
              className="border-t hover:bg-muted/30 cursor-pointer"
              onClick={() => handleRow(s)}
            >
              <td className="px-4 py-3 font-mono">{nullish(s.matric_no)}</td>
              <td className="px-4 py-3">
                {s.firstname} {s.lastname}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{nullish(s.department)}</td>
              <td className="px-4 py-3 text-muted-foreground">{nullish(s.program)}</td>
              <td className="px-4 py-3 text-muted-foreground">{nullish(s.level)}</td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRow(s);
                  }}
                  aria-label={`View ${s.firstname} ${s.lastname}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
