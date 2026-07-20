'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function CoursesFilter({
  initial = '',
  onDebouncedChange,
  delayMs = 250,
}: {
  initial?: string;
  onDebouncedChange: (value: string) => void;
  delayMs?: number;
}) {
  const [value, setValue] = useState(initial);
  const cbRef = useRef(onDebouncedChange);
  useEffect(() => {
    cbRef.current = onDebouncedChange;
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => cbRef.current(value.trim()), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return (
    <div className="flex items-center gap-2 max-w-sm">
      <Input
        type="search"
        inputMode="search"
        placeholder="Search by course code or name…"
        aria-label="Search courses"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setValue('')}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
