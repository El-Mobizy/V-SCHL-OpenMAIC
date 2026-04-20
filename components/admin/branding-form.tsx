'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBrandingEditor } from '@/lib/hooks/use-branding-editor';
import { cn } from '@/lib/utils';
import type { SchoolBranding } from '@/lib/types/school';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [textVal, setTextVal] = useState(value);
  const [invalid, setInvalid] = useState(false);

  const commit = (v: string) => {
    if (HEX_RE.test(v)) {
      setInvalid(false);
      onChange(v);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="w-36 text-sm font-medium shrink-0">{label}</label>
      <input
        type="color"
        value={HEX_RE.test(textVal) ? textVal : '#000000'}
        onChange={(e) => {
          setTextVal(e.target.value);
          onChange(e.target.value);
          setInvalid(false);
        }}
        className="w-8 h-8 cursor-pointer rounded border"
        title={`Pick ${label}`}
      />
      <Input
        value={textVal}
        maxLength={7}
        placeholder="#rrggbb"
        className={cn('max-w-32 font-mono text-sm', invalid && 'border-destructive')}
        onChange={(e) => setTextVal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        aria-label={label}
      />
      {invalid && <span className="text-xs text-destructive">Invalid hex (use #rrggbb)</span>}
    </div>
  );
}

export function BrandingForm({ initial }: { initial: SchoolBranding }) {
  const { current, draft, setField, dirty, save, error, isSaving } = useBrandingEditor(initial);

  // Merge current + draft for live preview
  const preview = {
    school_name: (draft.school_name ?? current.school_name) || 'School',
    primary_color: (draft.primary_color ?? current.primary_color) || '#000000',
    secondary_color: (draft.secondary_color ?? current.secondary_color) || '#ffffff',
    accent_color: (draft.accent_color ?? current.accent_color) || '#0000ff',
  };

  return (
    <div className="space-y-6">
      {/* School name */}
      <div className="space-y-1">
        <label htmlFor="school-name" className="text-sm font-medium">
          School name
        </label>
        <Input
          id="school-name"
          maxLength={200}
          required
          value={draft.school_name ?? current.school_name}
          onChange={(e) => setField('school_name', e.target.value)}
          placeholder="My School"
        />
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Brand colors</p>
        <ColorRow
          label="Primary color"
          value={draft.primary_color ?? current.primary_color}
          onChange={(v) => setField('primary_color', v)}
        />
        <ColorRow
          label="Secondary color"
          value={draft.secondary_color ?? current.secondary_color}
          onChange={(v) => setField('secondary_color', v)}
        />
        <ColorRow
          label="Accent color"
          value={draft.accent_color ?? current.accent_color}
          onChange={(v) => setField('accent_color', v)}
        />
      </div>

      {/* Live preview chip */}
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">Preview:</p>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{
            backgroundColor: preview.primary_color,
            color: preview.secondary_color,
            borderColor: preview.accent_color,
            borderWidth: 2,
            borderStyle: 'solid',
          }}
        >
          {preview.school_name}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.detail}
        </div>
      )}

      <Button onClick={save} disabled={!dirty || isSaving}>
        {isSaving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
