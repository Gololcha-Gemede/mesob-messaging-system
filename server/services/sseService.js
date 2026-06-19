/**
 * Server-Sent Events (SSE) service for real-time notifications.
 * Maintains a map of connected clients keyed by user ID.
 */

// Map of userId -> Set of response objects
const clients = new Map();

/**
 * Register a client for SSE notifications.
 * @param {number} userId
 * @param {import('express').Response} res
 */
function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  res.on('close', () => {
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  });
}

/**
 * Send an event to a specific user.
 * @param {number} userId
 * @param {string} event - Event type (e.g., 'new_message', 'notification_update')
 * @param {object} data - Payload to send
 */
function sendToUser(userId, event, data) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of userClients) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected, will be cleaned up by 'close' listener
    }
  }
}

/**
 * Broadcast an event to all connected clients.
 * @param {string} event
 * @param {object} data
 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, userClients] of clients) {
    for (const res of userClients) {
      try {
        res.write(payload);
      } catch {
        // Client disconnected
      }
    }
  }
}

/**
 * Get the number of connected clients.
 */
function getConnectedCount() {
  let count = 0;
  for (const userClients of clients) {
    count += userClients.size;
  }
  return count;
}

module.exports = { addClient, sendToUser, broadcast, getConnectedCount };
