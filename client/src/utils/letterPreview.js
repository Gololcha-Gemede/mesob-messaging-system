export const LETTER_TEMPLATES = [
  { value: 'official_letter', label: 'Official Letter' },
  { value: 'notice', label: 'Notice' }
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

function signatureSection({ senderName, senderTitle, signatureImagePath }) {
  const signatureImage = signatureImagePath
    ? `<img class="letter-signature-image" src="${escapeHtml(signatureImagePath)}" alt="${escapeHtml(senderName || 'Current user')} signature">`
    : '';
  const title = senderTitle ? `<span>${escapeHtml(senderTitle)}</span>` : '';
  return `
    <section class="letter-signature">
      ${signatureImage}
      <strong>${escapeHtml(senderName || 'Current user')}</strong>
      ${title}
    </section>
  `;
}

function noticeClosingSection({ senderName, senderTitle, signatureImagePath }) {
  const signatureImage = signatureImagePath
    ? `<img class="letter-signature-image" src="${escapeHtml(signatureImagePath)}" alt="${escapeHtml(senderName || 'Current user')} signature">`
    : '';
  const title = senderTitle ? `<span>${escapeHtml(senderTitle)}</span>` : '';
  return `
    <section class="letter-signature notice-closing">
      <strong>${escapeHtml(senderName || 'Current user')}</strong>
      ${title}
      ${signatureImage}
    </section>
  `;
}

function formatPreviewDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function header() {
  return `
    <header class="letter-header">
      <img src="/letter-header2.png" alt="A-MESOB Lideta Center">
    </header>
  `;
}

function footer() {
  return `
    <footer class="letter-footer">
      <div class="letter-footer-content">
        <div class="letter-footer-info">
          <div>Lideta Address: Burundi Street, Addis Ababa, Ethiopia</div>
          <div>Contact Center : 9838</div>
          <div>Tell :</div>
          <div>PoBox :</div>
          <div>Website : www.mesobcenter.net</div>
        </div>
        <div class="letter-footer-tagline">The New Horizon Of Service!</div>
      </div>
    </footer>
  `;
}

function officialLetterMeta({ referenceNumber, date, recipientLine }) {
  return `
    <section class="letter-top-meta">
      <div class="letter-top-meta__stack">
        <div>ቁጥር/Ref no: ${escapeHtml(referenceNumber)}</div>
        <div>ቀን/Date : ${escapeHtml(formatPreviewDate(date))}</div>
      </div>
    </section>
    <section class="letter-recipient-line">${escapeHtml(recipientLine || 'Recipient')}</section>
  `;
}

function officialLetterClosing({ senderName, signatureImagePath }) {
  const signatureImage = signatureImagePath
    ? `<img class="letter-signature-image" src="${escapeHtml(signatureImagePath)}" alt="${escapeHtml(senderName || 'Current user')} signature">`
    : '<span class="letter-signature-placeholder">Signature</span>';

  return `
    <section class="letter-closing-block">
      <p>ከሰላምታ ጋር</p>
      <div class="letter-closing-signature">${signatureImage}</div>
    </section>
  `;
}

export function buildClientLetterPreview({ templateType, recipientName, subject, content, file, senderName, senderTitle = '', signatureImagePath = '' }) {
  const template = LETTER_TEMPLATES.find((item) => item.value === templateType) || LETTER_TEMPLATES[0];
  const safeSubject = escapeHtml(subject || '(No subject)');
  let body;

  if (template.value === 'notice') {
    body = `
      ${header()}
      <section class="letter-top-meta">
        <div class="letter-top-meta__stack notice-meta">
          <div>ቁጥር/Ref no: REF/000/PREVIEW</div>
          <div>ቀን/Date : ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </section>
      <section class="letter-subject-line"><strong>${safeSubject}</strong></section>
      <section class="letter-body">${paragraphs(content)}</section>
    `;
  } else {
    body = `
      ${header()}
      ${officialLetterMeta({ referenceNumber: 'REF/000/PREVIEW', date: new Date(), recipientLine: recipientName })}
      <section class="letter-subject-line"><span>ጉዳዩ፡-</span><strong>${safeSubject}</strong></section>
      <section class="letter-body">${paragraphs(content)}</section>
    `;
  }

  return `
    <article class="official-letter" data-template="${escapeHtml(template.value)}">
      ${body}
      ${attachmentSection(file)}
      ${template.value === 'official_letter' ? officialLetterClosing({ senderName, signatureImagePath }) : template.value === 'notice' ? noticeClosingSection({ senderName, senderTitle, signatureImagePath }) : signatureSection({ senderName, senderTitle, signatureImagePath })}
      ${footer()}
    </article>
  `;
}
