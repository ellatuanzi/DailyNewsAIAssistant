export function log(message, extra = {}) {
  console.log(JSON.stringify({
    level: "info",
    message,
    ...extra,
    timestamp: new Date().toISOString()
  }));
}

export function warn(message, extra = {}) {
  console.warn(JSON.stringify({
    level: "warn",
    message,
    ...extra,
    timestamp: new Date().toISOString()
  }));
}
