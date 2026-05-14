const pool = require('./db');

async function ensureColumn(tableName, columnName, ddl) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  if (!rows.length) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

async function initSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS message_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      actor_id INT NULL,
      note TEXT NULL,
      from_status VARCHAR(50) NULL,
      to_status VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_message_events_message_id (message_id),
      CONSTRAINT fk_message_events_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )`
  );

  await ensureColumn('messages', 'submitted_at', 'submitted_at DATETIME NULL');
  await ensureColumn('messages', 'read_at', 'read_at DATETIME NULL');
  await ensureColumn('messages', 'parent_message_id', 'parent_message_id INT NULL');
  await ensureColumn('messages', 'due_date', 'due_date DATE NULL');
  await ensureColumn('messages', 'created_at', 'created_at DATETIME NULL');
  await ensureColumn('messages', 'raw_content', 'raw_content TEXT NULL');
  await ensureColumn('messages', 'formatted_content', 'formatted_content MEDIUMTEXT NULL');
  await ensureColumn('messages', 'template_type', "template_type VARCHAR(40) NOT NULL DEFAULT 'official_letter'");
  await ensureColumn('messages', 'pdf_path', 'pdf_path VARCHAR(500) NULL');
  await ensureColumn('messages', 'opened_at', 'opened_at DATETIME NULL');
  await ensureColumn('messages', 'printed_at', 'printed_at DATETIME NULL');
  await ensureColumn('messages', 'downloaded_at', 'downloaded_at DATETIME NULL');
  await ensureColumn('messages', 'delivered_at', 'delivered_at DATETIME NULL');
  await ensureColumn('messages', 'file_name', 'file_name VARCHAR(255) NULL');
  await ensureColumn('messages', 'file_mime', 'file_mime VARCHAR(120) NULL');
  await ensureColumn('messages', 'file_size', 'file_size INT NULL');
  await ensureColumn('users', 'profile_image_path', 'profile_image_path VARCHAR(255) NULL');
  await ensureColumn('users', 'position_title', 'position_title VARCHAR(255) NULL');
  await ensureColumn('users', 'signature_image_path', 'signature_image_path VARCHAR(255) NULL');

  await pool.query(
    `UPDATE messages
     SET raw_content = COALESCE(raw_content, content),
         template_type = COALESCE(NULLIF(template_type, ''), 'official_letter')`
  );

  // Ensure status enum matches the schema in setup-database.sql without crashing if data doesn't fit.
  // If existing rows contain unexpected status values, map them to 'draft' first.
  await pool.query(
    `UPDATE messages
     SET status = 'draft'
     WHERE status NOT IN ('draft','submitted','received','read','sent','delivered','opened','printed','downloaded_pdf')`
  );

  // Then try to align enum definition.
  // (Some MySQL versions can throw data truncation if enum set differs; above update prevents that.)
  await pool.query(
    `ALTER TABLE messages
     MODIFY status ENUM('draft', 'submitted', 'received', 'read', 'sent', 'delivered', 'opened', 'printed', 'downloaded_pdf')
     DEFAULT 'draft'`
  );


  const [indexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'uniq_reference_number'");
  if (!indexes.length) {
    await pool.query('CREATE UNIQUE INDEX uniq_reference_number ON messages (reference_number)');
  }

  const [parentIndexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'idx_messages_parent_message_id'");
  if (!parentIndexes.length) {
    await pool.query('CREATE INDEX idx_messages_parent_message_id ON messages (parent_message_id)');
  }

  const [pdfIndexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'idx_messages_pdf_path'");
  if (!pdfIndexes.length) {
    await pool.query('CREATE INDEX idx_messages_pdf_path ON messages (pdf_path)');
  }
}

module.exports = { initSchema };
