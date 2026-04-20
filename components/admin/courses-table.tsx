'use client';
import type { Course } from '@/lib/types/school';

function nullish(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

export function CoursesTable({ courses }: { courses: Course[] }) {
  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No courses found.</p>;
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="px-4 py-2">
              Title
            </th>
            <th scope="col" className="px-4 py-2">
              Department
            </th>
            <th scope="col" className="px-4 py-2">
              Program
            </th>
            <th scope="col" className="px-4 py-2">
              Level
            </th>
            <th scope="col" className="px-4 py-2">
              Objectives
            </th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.uuid} className="border-t hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{c.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{nullish(c.department)}</td>
              <td className="px-4 py-3 text-muted-foreground">{nullish(c.program)}</td>
              <td className="px-4 py-3 text-muted-foreground">{nullish(c.level)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.objectives === null || !c.objectives.trim() ? '—' : '✓'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
