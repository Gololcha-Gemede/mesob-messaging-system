export const LETTER_TEMPLATES = [
  { value: 'official_letter', label: 'Official Letter' },
  { value: 'memo', label: 'Memo' },
  { value: 'notice', label: 'Notice' },
  { value: 'circular', label: 'Circular' },
  { value: 'request_form', label: 'Request Form' }
];

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
  if (/^(https?:|mailto:|tel:|#)/i.test(clean)) return clean;
  return '';
}

function sanitizeRichHtml(value) {
  const input = String(value || '');
  const allowedTags = new Set(['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'ol', 'ul', 'li', 'a']);
  let output = '';
  let cursor = 0;
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

  for (const match of input.matchAll(tagRegex)) {
    output += escapeHtml(input.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const tag = match[1].toLowerCase();
    if (!allowedTags.has(tag)) continue;

    const isClosing = /^<\//.test(match[0]);
    if (tag === 'br') {
      if (!isClosing) output += '<br>';
      continue;
    }

    if (isClosing) {
      output += `</${tag}>`;
      continue;
    }

    if (tag === 'a') {
      const hrefMatch = match[0].match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = sanitizeUrl(hrefMatch?.[2] || hrefMatch?.[3] || hrefMatch?.[4] || '');
      output += href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">` : '<a>';
      continue;
    }

    output += `<${tag}>`;
  }

  output += escapeHtml(input.slice(cursor));
  return output
    .replace(/<div><br><\/div>/gi, '<p>&nbsp;</p>')
    .replace(/<div>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .trim();
}

function paragraphs(content) {
  const clean = String(content || '').trim();
  if (!clean) return '<p>&nbsp;</p>';
  // If content already contains HTML tags (from rich editor), render as-is
  if (/<[^>]+>/.test(clean)) {
    return `<div class="rich-content">${sanitizeRichHtml(clean)}</div>`;
  }
  // Otherwise, treat as plain text and wrap in paragraphs
  return clean
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function attachmentSection(file) {
  if (!file?.name) return '';
  const sizeLabel = file.size ? ` (${Math.ceil(file.size / 1024)} KB)` : '';
  return `
    <section class="letter-attachments">
      <strong>Attachments:</strong>
      <ul><li>${escapeHtml(file.name)}${escapeHtml(sizeLabel)}</li></ul>
    </section>
  `;
}

function header({ templateLabel, recipientName, senderName }) {
  return `
    <header class="letter-header">
      <div class="letter-logo-slot"><img src="/qms-logo.png" alt=""></div>
      <div>
        <h1>MESOB INTERNAL MESSAGING SYSTEM</h1>
        <p>${escapeHtml(templateLabel)} Internal Correspondence</p>
      </div>
    </header>
    <section class="letter-meta-grid">
      <div><strong>Reference No:</strong> IMS-${new Date().getFullYear()}-PREVIEW</div>
      <div><strong>Date:</strong> ${escapeHtml(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</div>
      <div><strong>From:</strong> ${escapeHtml(senderName || 'Current user')}</div>
      <div><strong>To:</strong> ${escapeHtml(recipientName || 'Recipient')}</div>
    </section>
  `;
}

export function buildClientLetterPreview({ templateType, recipientName, subject, content, file, senderName }) {
  const template = LETTER_TEMPLATES.find((item) => item.value === templateType) || LETTER_TEMPLATES[0];
  const safeSubject = escapeHtml(subject || '(No subject)');
  const safeRecipient = escapeHtml(recipientName || 'Recipient');
  let body;

  if (template.value === 'memo') {
    body = `
      ${header({ templateLabel: 'Memo', recipientName, senderName })}
      <section class="letter-subject"><span>Memo</span><strong>${safeSubject}</strong></section>
      <section class="letter-body">${paragraphs(content)}<p>For your information and necessary action.</p></section>
    `;
  } else if (template.value === 'notice') {
    body = `
      ${header({ templateLabel: 'Notice', recipientName, senderName })}
      <section class="letter-notice-title">NOTICE</section>
      <section class="letter-subject"><span>Regarding</span><strong>${safeSubject}</strong></section>
      <section class="letter-body">${paragraphs(content)}</section>
    `;
  } else if (template.value === 'circular') {
    body = `
      ${header({ templateLabel: 'Circular', recipientName, senderName })}
      <section class="letter-notice-title">CIRCULAR</section>
      <section class="letter-subject"><span>Subject</span><strong>${safeSubject}</strong></section>
      <section class="letter-body"><p>Dear Team,</p>${paragraphs(content)}<p>Kind regards,</p></section>
    `;
  } else if (template.value === 'request_form') {
    body = `
      ${header({ templateLabel: 'Request Form', recipientName, senderName })}
      <section class="letter-subject"><span>Request</span><strong>${safeSubject}</strong></section>
      <section class="letter-request-box">
        <div><strong>Requested by</strong><span>Current user</span></div>
        <div><strong>Submitted to</strong><span>${safeRecipient}</span></div>
        <div><strong>Reference</strong><span>IMS-${new Date().getFullYear()}-PREVIEW</span></div>
      </section>
      <section class="letter-body">${paragraphs(content)}</section>
    `;
  } else {
    body = `
      ${header({ templateLabel: 'Official', recipientName, senderName })}
      <section class="letter-subject"><span>Subject</span><strong>${safeSubject}</strong></section>
      <section class="letter-body"><p>Dear ${safeRecipient},</p>${paragraphs(content)}<p>Kind regards,</p></section>
    `;
  }

  return `
    <article class="official-letter" data-template="${escapeHtml(template.value)}">
      ${body}
      ${attachmentSection(file)}
      <section class="letter-signature"><strong>${escapeHtml(senderName || 'Current user')}</strong></section>
      <footer class="letter-footer">${escapeHtml(template.label)} generated by MESOB Internal Messaging System</footer>
    </article>
  `;
}
