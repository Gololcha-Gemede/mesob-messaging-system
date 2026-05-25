function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(value) {
  const clean = String(value || '').trim();
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(clean)) return clean;
  return '';
}

export function sanitizeHtml(value) {
  const input = String(value || '');
  const allowedTags = new Set([
    'article', 'header', 'footer', 'section', 'div', 'p', 'span', 'strong', 'b', 'em', 'i', 'u',
    'br', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'a'
  ]);
  const allowedAttrs = new Set(['class', 'data-template', 'colspan', 'rowspan', 'alt']);
  let output = '';
  let cursor = 0;
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

  for (const match of input.matchAll(tagRegex)) {
    output += escapeHtml(input.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const tag = match[1].toLowerCase();
    if (!allowedTags.has(tag)) continue;

    const closing = /^<\//.test(match[0]);
    if (closing) {
      if (tag !== 'br' && tag !== 'img') output += `</${tag}>`;
      continue;
    }

    const attrs = [];
    for (const attr of match[0].matchAll(/\s([a-z_:][-a-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const name = attr[1].toLowerCase();
      const rawValue = attr[3] || attr[4] || attr[5] || '';
      if (name.startsWith('on')) continue;
      if (tag === 'a' && name === 'href') {
        const href = sanitizeUrl(rawValue);
        if (href) attrs.push(`href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank"`);
        continue;
      }
      if (tag === 'img' && name === 'src') {
        const src = sanitizeUrl(rawValue);
        if (src) attrs.push(`src="${escapeHtml(src)}"`);
        continue;
      }
      if (allowedAttrs.has(name)) attrs.push(`${name}="${escapeHtml(rawValue)}"`);
    }

    output += `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
  }

  output += escapeHtml(input.slice(cursor));
  return output;
}
