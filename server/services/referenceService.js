const pool = require('../models/db');
const departmentModel = require('../models/department');

function padNumber(value, size = 3) {
  return String(value).padStart(size, '0');
}

async function nextReferenceNumber(departmentId, year = new Date().getFullYear()) {
  let deptCode = 'GEN';
  if (departmentId) {
    const dept = await departmentModel.getById(departmentId);
    if (dept?.code) deptCode = String(dept.code).toUpperCase().trim();
  }

  const suffix = `/${year}`;
  const [rows] = await pool.query(
    `SELECT reference_number
     FROM messages
     WHERE reference_number LIKE ?
     ORDER BY reference_number DESC
     LIMIT 1`,
    [`${deptCode}/%${suffix}`]
  );

  const lastRef = rows[0]?.reference_number || '';
  const middlePart = lastRef.split('/')[1] || '';
  const lastNumber = Number(middlePart);
  const nextNumber = Number.isInteger(lastNumber) ? lastNumber + 1 : 1;

  return `${deptCode}/${padNumber(nextNumber)}/${year}`;
}

async function withLockedReference(callback, departmentId) {
  const year = new Date().getFullYear();
  const lockName = `message-reference-${year}`;
  const [[lockResult]] = await pool.query('SELECT GET_LOCK(?, 10) AS locked', [lockName]);
  if (lockResult?.locked !== 1) {
    throw new Error('Unable to reserve a reference number');
  }

  try {
    const referenceNumber = await nextReferenceNumber(departmentId, year);
    return await callback(referenceNumber);
  } finally {
    await pool.query('SELECT RELEASE_LOCK(?)', [lockName]);
  }
}

module.exports = {
  withLockedReference
};
