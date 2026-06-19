import { forwardRef } from 'react';

const LOGO_SRC = '/letter-header2.png';

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
      <header className="letter-header">
        <img src={LOGO_SRC} alt="A-MESOB Lideta Center" />
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

      <footer className="letter-footer">
        <div className="letter-footer-content">
          <div className="letter-footer-info">
            <div>Lideta Address: Burundi Street, Addis Ababa, Ethiopia</div>
            <div>Contact Center : 9838</div>
            <div>Tell :</div>
            <div>PoBox :</div>
            <div>Website : www.mesobcenter.net</div>
          </div>
          <div className="letter-footer-tagline">The New Horizon Of Service!</div>
        </div>
      </footer>
    </article>
  );
});

export default FormalLetterTemplate;
