const pool = require('../models/db');

function padNumber(value, size = 6) {
  return String(value).padStart(size, '0');
}

async function nextReferenceNumber(year = new Date().getFullYear()) {
  const prefix = `IMS-${year}-`;
  const [rows] = await pool.query(
    `SELECT reference_number
     FROM messages
     WHERE reference_number LIKE ?
     ORDER BY reference_number DESC
     LIMIT 1`,
    [`${prefix}%`]
  );
  const lastNumber = Number(String(rows[0]?.reference_number || '').split('-').pop());
  const nextNumber = Number.isInteger(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}${padNumber(nextNumber)}`;
}

async function withLockedReference(callback) {
  const year = new Date().getFullYear();
  const lockName = `message-reference-${year}`;
  const [[lockResult]] = await pool.query('SELECT GET_LOCK(?, 10) AS locked', [lockName]);
  if (lockResult?.locked !== 1) {
    throw new Error('Unable to reserve a reference number');
  }

  try {
    const referenceNumber = await nextReferenceNumber(year);
    return await callback(referenceNumber);
  } finally {
    await pool.query('SELECT RELEASE_LOCK(?)', [lockName]);
  }
}

module.exports = {
  withLockedReference
};
