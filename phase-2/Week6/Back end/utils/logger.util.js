function formatLogEntry({ requestId, decision, statusCode, processingMs, error }) {
  const log = {
    requestId,
    timestamp: new Date().toISOString(),
    decision,
    processingMs,
    statusCode
  };

  if (error) {
    log.error = error;
  }

  return log;
}

function logOperation(entry) {
  console.log(JSON.stringify(formatLogEntry(entry)));
}

module.exports = { logOperation, formatLogEntry };
