'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function MatricFilter({
  initial = '',
  onDebouncedChange,
  delayMs = 250,
}: {
  initial?: string;
  onDebouncedChange: (value: string) => void;
  delayMs?: number;
}) {
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onDebouncedChange(value), delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delayMs, onDebouncedChange]);

  return (
    <div className="flex items-center gap-2 max-w-sm">
      <Input
        type="text"
        inputMode="text"
        placeholder="Filter by matric number…"
        aria-label="Matric filter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
      {value && (
        <Button variant="ghost" size="icon" onClick={() => setValue('')} aria-label="Clear filter">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
