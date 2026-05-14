import { forwardRef } from 'react';

const LOGO_SRC = '/qms-logo.png';

function formatDate(value) {
  if (!value) return new Date().toLocaleDateString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

const FormalLetterTemplate = forwardRef(function FormalLetterTemplate({
  subject = '',
  body = '',
  referenceNumber = '',
  senderNameTitle = '',
  receiverNameTitle = '',
  salutation = '',
  closingText = '',
  signatureSection = '',
  date = ''
}, ref) {
  return (
    <article className="formal-letter-template" ref={ref}>
      <header className="formal-letter-header">
        <img className="formal-letter-logo" src={LOGO_SRC} alt="" />
        <div>
          <h1>MESOB Internal Message Management System</h1>
          <p>Official Correspondence</p>
        </div>
      </header>

      <section className="formal-letter-meta">
        <div>
          <strong>From</strong>
          <span>{senderNameTitle || 'Sender name/title'}</span>
        </div>
        <div>
          <strong>To</strong>
          <span>{receiverNameTitle || 'Receiver name/title'}</span>
        </div>
        <div>
          <strong>Date</strong>
          <span>{formatDate(date)}</span>
        </div>
        {referenceNumber ? (
          <div>
            <strong>Reference</strong>
            <span>{referenceNumber}</span>
          </div>
        ) : null}
      </section>

      <div className="formal-letter-subject">
        <span>Subject</span>
        <strong>{subject || '(No subject)'}</strong>
      </div>

      <div className="formal-letter-body">
        <p>{salutation || 'Dear Sir/Madam,'}</p>
        <p>{body || 'Message body'}</p>
        <p>{closingText || 'Sincerely,'}</p>
      </div>

      <section className="formal-letter-signature">
        <div className="signature-line" />
        <p>{signatureSection || senderNameTitle || 'Signature section'}</p>
      </section>

      <footer className="formal-letter-footer">
        <span>MESOB IMMS</span>
        <span>Generated formal letter correspondence</span>
      </footer>
    </article>
  );
});

export default FormalLetterTemplate;
