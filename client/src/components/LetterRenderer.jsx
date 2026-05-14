export default function LetterRenderer({ html, fallback = '' }) {
  if (html) {
    return <div className="letter-renderer" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className="letter-renderer">
      <article className="official-letter official-letter--empty">
        {fallback || 'Letter preview will appear here.'}
      </article>
    </div>
  );
}
