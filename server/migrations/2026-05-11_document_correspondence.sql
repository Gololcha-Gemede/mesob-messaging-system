ALTER TABLE messages
  ADD COLUMN raw_content TEXT NULL,
  ADD COLUMN formatted_content MEDIUMTEXT NULL,
  ADD COLUMN template_type VARCHAR(40) NOT NULL DEFAULT 'official_letter',
  ADD COLUMN pdf_path VARCHAR(500) NULL,
  ADD COLUMN opened_at DATETIME NULL,
  ADD COLUMN printed_at DATETIME NULL,
  ADD COLUMN downloaded_at DATETIME NULL,
  ADD COLUMN delivered_at DATETIME NULL,
  ADD COLUMN file_name VARCHAR(255) NULL,
  ADD COLUMN file_mime VARCHAR(120) NULL,
  ADD COLUMN file_size INT NULL;

UPDATE messages
SET raw_content = COALESCE(raw_content, content),
    template_type = COALESCE(NULLIF(template_type, ''), 'official_letter');

ALTER TABLE messages
  MODIFY status ENUM('draft', 'submitted', 'received', 'read', 'sent', 'delivered', 'opened', 'printed', 'downloaded_pdf')
  DEFAULT 'draft';

ALTER TABLE users
  ADD COLUMN position_title VARCHAR(255) NULL,
  ADD COLUMN signature_image_path VARCHAR(255) NULL;

CREATE INDEX idx_messages_pdf_path ON messages (pdf_path);
