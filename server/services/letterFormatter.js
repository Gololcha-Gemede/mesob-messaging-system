const TEMPLATE_LABELS = {
  official_letter: 'Official Letter',
  memo: 'Memo',
  notice: 'Notice',
  circular: 'Circular'
};

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

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function paragraphsFromContent(content) {
  const clean = String(content || '').trim();
  if (!clean) return '<p>&nbsp;</p>';
  if (/<[^>]+>/.test(clean)) return `<div class="rich-content">${sanitizeRichHtml(clean)}</div>`;
  return clean
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function officialLetterMeta(data) {
  return `
    ${baseHeader(data, 'Official')}
    <section class="letter-top-meta">
      <div class="letter-top-meta__stack">
        <div>ቁጥር/Ref no: ${escapeHtml(data.referenceNumber)}</div>
        <div>ቀን/Date : ${escapeHtml(formatDate(data.date))}</div>
      </div>
    </section>
    <section class="letter-recipient-line">${escapeHtml(data.recipientLine || data.recipientName)}</section>
  `;
}

function officialLetterClosing(data) {
  const signatureImage = data.signatureImagePath
    ? `<img class="letter-signature-image" src="${escapeHtml(data.signatureImagePath)}" alt="${escapeHtml(data.senderName)} signature">`
    : '<span class="letter-signature-placeholder">Signature</span>';

  return `
    <section class="letter-closing-block">
      <p>ከሰላምታ ጋር</p>
      <div class="letter-closing-signature">${signatureImage}</div>
    </section>
  `;
}

function attachmentRows(attachments = []) {
  const cleanAttachments = attachments.filter((item) => item?.name);
  if (!cleanAttachments.length) return '';

  const rows = cleanAttachments.map((item) => {
    const size = Number(item.size);
    const sizeLabel = Number.isFinite(size) && size > 0 ? ` (${Math.ceil(size / 1024)} KB)` : '';
    return `<li>${escapeHtml(item.name)}${escapeHtml(sizeLabel)}</li>`;
  }).join('');

  return `
    <section class="letter-attachments">
      <strong>Attachments:</strong>
      <ul>${rows}</ul>
    </section>
  `;
}

function signatureBlock(data) {
  const signatureImage = data.signatureImagePath
    ? `<img class="letter-signature-image" src="${escapeHtml(data.signatureImagePath)}" alt="${escapeHtml(data.senderName)} signature">`
    : '';
  const title = data.senderTitle ? `<span>${escapeHtml(data.senderTitle)}</span>` : '';
  return `
    <section class="letter-signature">
      ${signatureImage}
      <strong>${escapeHtml(data.senderName)}</strong>
      ${title}
    </section>
  `;
}

function baseHeader() {
  return `
    <header class="letter-header">
      <img src="/letter-header2.png" alt="A-MESOB Lideta Center">
    </header>
  `;
}

function baseFooter(label) {
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

function officialLetter(data) {
  return `
    ${officialLetterMeta(data)}
    <section class="letter-subject-line"><span>ጉዳዩ፡-</span><strong>${escapeHtml(data.subject)}</strong></section>
    <section class="letter-body">
      ${paragraphsFromContent(data.body)}
    </section>
    ${attachmentRows(data.attachments)}
    ${officialLetterClosing(data)}
  `;
}

function memo(data) {
  return `
    ${baseHeader(data, 'Memo')}
    <section class="letter-subject"><span>Memo</span><strong>${escapeHtml(data.subject)}</strong></section>
    <section class="letter-body">
      ${paragraphsFromContent(data.body)}
      <p>For your information and necessary action.</p>
    </section>
    ${attachmentRows(data.attachments)}
    ${signatureBlock(data)}
  `;
}

function noticeClosing(data) {
  const signatureImage = data.signatureImagePath
    ? `<img class="letter-signature-image" src="${escapeHtml(data.signatureImagePath)}" alt="${escapeHtml(data.senderName)} signature">`
    : '<span class="letter-signature-placeholder">Signature</span>';
  const title = data.senderTitle ? `<span>${escapeHtml(data.senderTitle)}</span>` : '';
  return `
    <section class="letter-signature notice-closing">
      <strong>${escapeHtml(data.senderName)}</strong>
      ${title}
      ${signatureImage}
    </section>
  `;
}

function notice(data) {
  return `
    ${baseHeader(data, 'Notice')}
    <section class="letter-top-meta">
      <div class="letter-top-meta__stack notice-meta">
        <div>ቁጥር/Ref no: ${escapeHtml(data.referenceNumber)}</div>
        <div>ቀን/Date : ${escapeHtml(formatDate(data.date))}</div>
      </div>
    </section>
    <section class="letter-subject-line"><strong>${escapeHtml(data.subject)}</strong></section>
    <section class="letter-body">${paragraphsFromContent(data.body)}</section>
    ${attachmentRows(data.attachments)}
    ${noticeClosing(data)}
  `;
}

function circular(data) {
  return `
    ${baseHeader(data, 'Circular')}
    <section class="letter-notice-title">CIRCULAR</section>
    <section class="letter-subject"><span>Subject</span><strong>${escapeHtml(data.subject)}</strong></section>
    <section class="letter-body">
      <p>Dear Team,</p>
      ${paragraphsFromContent(data.body)}
      <p>Kind regards,</p>
    </section>
    ${attachmentRows(data.attachments)}
    ${signatureBlock(data)}
  `;
}

const TEMPLATE_RENDERERS = {
  official_letter: officialLetter,
  memo,
  notice,
  circular
};

function normalizeTemplateType(templateType) {
  return TEMPLATE_RENDERERS[templateType] ? templateType : 'official_letter';
}

function buildLetterData(input = {}) {
  return {
    templateType: normalizeTemplateType(input.templateType),
    referenceNumber: input.referenceNumber || `REF/000/PREVIEW`,
    date: input.date || new Date(),
    senderName: input.senderName || 'Sender',
    senderTitle: input.senderTitle || '',
    recipientName: input.recipientName || 'Recipient',
    recipientLine: input.recipientLine || input.recipientName || 'Recipient',
    subject: input.subject || '(No subject)',
    body: input.body || '',
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    signatureImagePath: input.signatureImagePath || '',
    logoUrl: input.logoUrl || '/qms-logo.png'
  };
}

function generateLetterHtml(input) {
  const data = buildLetterData(input);
  const label = TEMPLATE_LABELS[data.templateType] || TEMPLATE_LABELS.official_letter;
  const body = TEMPLATE_RENDERERS[data.templateType](data);

  return `
    <article class="official-letter" data-template="${escapeHtml(data.templateType)}">
      ${body}
      ${baseFooter(label)}
    </article>
  `.trim();
}

function getTemplateOptions() {
  return Object.entries(TEMPLATE_LABELS).map(([value, label]) => ({ value, label }));
}

module.exports = {
  escapeHtml,
  formatDate,
  generateLetterHtml,
  getTemplateOptions,
  normalizeTemplateType,
  buildLetterData
};
