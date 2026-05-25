import { htmlToPlainText } from '../utils/htmlToPlainText';
import { sanitizeHtml } from '../utils/sanitizeHtml';

export default function LetterRenderer({ html, fallback = '', mode = 'rich' }) {
  if (html) {
    if (mode === 'plain') {
      return (
        <div className="letter-renderer letter-renderer--plain" style={{ whiteSpace: 'pre-wrap' }}>
          {htmlToPlainText(html)}
        </div>
      );
    }

    return <div className="letter-renderer" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
  }

  const text = fallback || 'Letter preview will appear here.';
  if (mode === 'plain') {
    return (
      <div className="letter-renderer letter-renderer--plain" style={{ whiteSpace: 'pre-wrap' }}>
        {String(text)}
      </div>
    );
  }

  return (
    <div className="letter-renderer">
      <article className="official-letter official-letter--empty">{text}</article>
    </div>
  );
}
