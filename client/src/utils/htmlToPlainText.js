export function htmlToPlainText(html) {
  const input = String(html ?? '');
  if (!input.trim()) return '';

  // Decode a small set of entities that are known to appear in previews.
  const decoded = input
    .replace(/\r\n/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'");

  // Convert block-ish tags to newlines BEFORE stripping remaining tags.
  let normalized = decoded;
  normalized = normalized.replace(/<\s*br\s*\/?>/gi, '\n');

  // Paragraph / div / section spacing
  normalized = normalized.replace(/<\s*\/\s*(p|div|section|article)\s*>/gi, '\n\n');
  normalized = normalized.replace(/<\s*(p|div|section|article)(\s+[^>]*)?>/gi, (m) => (m.toLowerCase().startsWith('</') ? '' : ''));

  // Lists
  normalized = normalized.replace(/<\s*li(\s+[^>]*)?>/gi, '- ');
  normalized = normalized.replace(/<\s*\/\s*li\s*>/gi, '\n');

  // Remove all remaining tags.
  normalized = normalized.replace(/<[^>]+>/g, '');

  // Cleanup whitespace.
  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trimEnd())
    .join('\n');

  // Collapse many blank lines to max 2 newlines.
  return lines.replace(/\n{3,}/g, '\n\n').trim();
}

