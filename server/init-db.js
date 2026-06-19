const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    console.log('Database created or already exists');

    // Use database
    await connection.query(`USE ${process.env.DB_NAME}`);

    // Create tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'user') DEFAULT 'user',
        department_id INT NULL,
        profile_image_path VARCHAR(255) NULL,
        position_title VARCHAR(255) NULL,
        signature_image_path VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(10) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NULL,
        receiver_name VARCHAR(255) NULL,
        subject VARCHAR(255) NOT NULL,
        content TEXT,
        raw_content TEXT,
        formatted_content MEDIUMTEXT,
        template_type VARCHAR(40) NOT NULL DEFAULT 'official_letter',
        reference_number VARCHAR(255) UNIQUE NOT NULL,
        status ENUM('draft', 'submitted', 'received', 'read', 'sent', 'delivered', 'opened', 'printed', 'downloaded_pdf') DEFAULT 'draft',
        file_path VARCHAR(255) NULL,
        file_name VARCHAR(255) NULL,
        file_mime VARCHAR(120) NULL,
        file_size INT NULL,
        pdf_path VARCHAR(500) NULL,
        department_id INT NOT NULL,
        due_date DATE NULL,
        submitted_at DATETIME NULL,
        delivered_at DATETIME NULL,
        read_at DATETIME NULL,
        opened_at DATETIME NULL,
        printed_at DATETIME NULL,
        downloaded_at DATETIME NULL,
        parent_message_id INT NULL,
        created_at DATETIME NULL,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (parent_message_id) REFERENCES messages(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS message_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        actor_id INT NULL,
        note TEXT NULL,
        from_status VARCHAR(50) NULL,
        to_status VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    try {
      await connection.query(`CREATE UNIQUE INDEX uniq_reference_number ON messages (reference_number)`);
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }
    
    try {
      await connection.query(`CREATE INDEX idx_message_events_message_id ON message_events (message_id)`);
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }

    // Insert sample data
    await connection.query(`
      INSERT IGNORE INTO departments (id, name, code) VALUES (1, 'Information Technology', 'IT'), (2, 'Human Resources', 'HRD'), (3, 'Finance', 'FIN')
    `);

    await connection.query(`
      INSERT IGNORE INTO users (id, name, email, password, role, department_id) VALUES 
      (1, 'Admin User', 'admin@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', 'admin', 1),
      (2, 'Regular User', 'user@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', 'user', 2)
    `);

    console.log('Database initialized successfully');
    await connection.end();
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
