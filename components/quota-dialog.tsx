'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface QuotaDialogProps {
  open: boolean;
  resetDate: string | null;
  onDismiss: () => void;
}

export function QuotaDialog({ open, resetDate, onDismiss }: QuotaDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Token Limit Reached</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve used all your available tokens for this period.
            {resetDate && (
              <>
                {' '}
                Your quota will reset on <strong>{new Date(resetDate).toLocaleDateString()}</strong>
                .
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            You can still view your existing course content, but AI features (chat, generation) are
            paused until your quota resets.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onDismiss}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
