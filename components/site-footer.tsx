import { ExternalLink } from 'lucide-react';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-card/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>&copy; {year} All rights reserved.</span>
        <span className="inline-flex items-center gap-1">
          Designed by{' '}
          <a
            href="https://v-studio.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-semibold text-foreground/90 hover:text-primary underline-offset-4 hover:underline transition-colors"
          >
            V-STUDIO
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </span>
      </div>
    </footer>
  );
}
