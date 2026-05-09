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
  await ensureColumn('users', 'profile_image_path', 'profile_image_path VARCHAR(255) NULL');

  const [indexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'uniq_reference_number'");
  if (!indexes.length) {
    await pool.query('CREATE UNIQUE INDEX uniq_reference_number ON messages (reference_number)');
  }

  const [parentIndexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'idx_messages_parent_message_id'");
  if (!parentIndexes.length) {
    await pool.query('CREATE INDEX idx_messages_parent_message_id ON messages (parent_message_id)');
  }
}

module.exports = { initSchema };
