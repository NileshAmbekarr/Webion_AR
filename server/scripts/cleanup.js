const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_DIR = process.env.AR_TEMP_DIR || path.join(os.tmpdir(), 'ar_sessions');
const MAX_AGE_MS = (parseInt(process.env.AR_SESSION_TTL_HOURS) || 1) * 60 * 60 * 1000;

/**
 * Cleanup expired AR session directories.
 * Deletes session folders older than AR_SESSION_TTL_HOURS.
 */
function cleanup() {
  if (!fs.existsSync(SESSION_DIR)) return;

  const sessions = fs.readdirSync(SESSION_DIR);
  const now = Date.now();
  let deleted = 0;

  sessions.forEach(sessionId => {
    const dirPath = path.join(SESSION_DIR, sessionId);
    try {
      const stat = fs.statSync(dirPath);
      if (stat.isDirectory() && (now - stat.mtimeMs > MAX_AGE_MS)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        deleted++;
        console.log(`[AR Cleanup] Deleted expired session: ${sessionId}`);
      }
    } catch (err) {
      console.error(`[AR Cleanup] Error processing ${sessionId}:`, err.message);
    }
  });

  if (deleted > 0) {
    console.log(`[AR Cleanup] Cleaned up ${deleted} expired sessions.`);
  }
}

// Run cleanup every 15 minutes
function startCleanupJob() {
  console.log('[AR Cleanup] Starting cleanup job (every 15 minutes)');
  cron.schedule('*/15 * * * *', cleanup);
  // Also run once at startup
  cleanup();
}

module.exports = { cleanup, startCleanupJob };
