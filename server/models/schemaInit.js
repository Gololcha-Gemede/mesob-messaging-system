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

  await pool.query(
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(80) NOT NULL,
      actor_id INT NULL,
      ip VARCHAR(80) NULL,
      user_agent VARCHAR(255) NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_logs_event_type (event_type),
      INDEX idx_audit_logs_actor_id (actor_id),
      INDEX idx_audit_logs_created_at (created_at)
    )`
  );

  await ensureColumn('messages', 'submitted_at', 'submitted_at DATETIME NULL');
  await ensureColumn('messages', 'read_at', 'read_at DATETIME NULL');
  await ensureColumn('messages', 'parent_message_id', 'parent_message_id INT NULL');
  await ensureColumn('messages', 'due_date', 'due_date DATE NULL');

  await ensureColumn('departments', 'code', 'code VARCHAR(10) NULL');

  const [deptCodeIndex] = await pool.query("SHOW INDEX FROM departments WHERE Key_name = 'uniq_dept_code'");
  if (!deptCodeIndex.length) {
    await pool.query('CREATE UNIQUE INDEX uniq_dept_code ON departments (code)');
  }
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
  await ensureColumn('messages', 'sender_name', 'sender_name VARCHAR(255) NULL');
  await ensureColumn('messages', 'is_flagged', 'is_flagged BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('messages', 'is_archived', 'is_archived BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('messages', 'view_count', 'view_count INT NOT NULL DEFAULT 0');
  await ensureColumn('messages', 'last_activity_at', 'last_activity_at DATETIME NULL');
  await ensureColumn('users', 'profile_image_path', 'profile_image_path VARCHAR(255) NULL');
  await ensureColumn('users', 'position_title', 'position_title VARCHAR(255) NULL');
  await ensureColumn('users', 'signature_image_path', 'signature_image_path VARCHAR(255) NULL');

  // Existing databases may contain legacy role values such as "staff" or
  // invalid enum blanks. Normalize them before tightening the role enum.
  await pool.query(
    `ALTER TABLE users
     MODIFY role VARCHAR(32) NOT NULL DEFAULT 'user'`
  );
  await pool.query(
    `UPDATE users
     SET role = CASE
       WHEN LOWER(TRIM(role)) = 'admin' THEN 'admin'
       WHEN LOWER(TRIM(role)) = 'manager' THEN 'manager'
       ELSE 'user'
     END`
  );
  await pool.query(
    `ALTER TABLE users
     MODIFY role ENUM('admin', 'manager', 'user') DEFAULT 'user'`
  );

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

  const [archivedIndexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'idx_messages_is_archived'");
  if (!archivedIndexes.length) {
    await pool.query('CREATE INDEX idx_messages_is_archived ON messages (is_archived)');
  }
}

module.exports = { initSchema };
