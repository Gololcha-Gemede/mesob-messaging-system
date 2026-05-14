const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredEnv = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
    `Create a .env file at repo root (c:/Users/Hena/mesob-messaging-system/.env) with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.`
  );
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

