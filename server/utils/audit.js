const pool = require('../models/db');

function audit(eventType, req, details = {}) {
  const entry = {
    at: new Date().toISOString(),
    event: eventType,
    actor_id: req.user?.id || null,
    ip: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.get?.('user-agent') || null,
    ...details
  };

  console.info(`[audit] ${JSON.stringify(entry)}`);
  pool.query(
    `INSERT INTO audit_logs (event_type, actor_id, ip, user_agent, details)
     VALUES (?, ?, ?, ?, ?)`,
    [
      eventType,
      entry.actor_id,
      entry.ip,
      entry.user_agent,
      JSON.stringify(details || {})
    ]
  ).catch((err) => {
    console.error('[audit] failed to persist audit log:', err.message);
  });
}

module.exports = { audit };
