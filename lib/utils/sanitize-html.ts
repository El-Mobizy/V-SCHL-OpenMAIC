// Minimal HTML sanitizer for admin-authored course content.
// Strips scripting surfaces (tags, event handlers, javascript: URLs) while
// preserving common rich-text markup. Not a general-purpose replacement for
// a full library like DOMPurify; intended for trusted-but-verified admin
// input. Whitelist-based sanitization from a DOM parser would be stricter,
// but that requires a browser/jsdom dependency this project does not carry.

const DANGEROUS_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'math',
];

const UNSAFE_URL_SCHEMES = /^\s*(javascript|vbscript|data):/i;
const DATA_IMAGE_PREFIX = /^\s*data:image\//i;

function stripTag(html: string, tag: string): string {
  const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
  const selfOrOpen = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  return html.replace(paired, '').replace(selfOrOpen, '');
}

function stripEventHandlers(html: string): string {
  return html.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function neutralizeUnsafeUrls(html: string): string {
  return html.replace(
    /\b(href|src|xlink:href|action|formaction|background|poster|cite)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, attr: string, dq?: string, sq?: string, bare?: string) => {
      const raw = (dq ?? sq ?? bare ?? '').trim();
      if (!raw) return match;
      if (UNSAFE_URL_SCHEMES.test(raw)) {
        if (DATA_IMAGE_PREFIX.test(raw) && attr.toLowerCase() === 'src') return match;
        return `${attr}="#"`;
      }
      return match;
    },
  );
}

export function sanitizeCourseHtml(input: string): string {
  let out = input;
  for (const tag of DANGEROUS_TAGS) out = stripTag(out, tag);
  out = stripEventHandlers(out);
  out = neutralizeUnsafeUrls(out);
  return out;
}
