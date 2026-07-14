/**
 * Minimal namespaced logger. Warnings and errors always log;
 * debug output is gated behind the "debugLogging" config flag,
 * which callers pass in (this module stays storage-agnostic so
 * it is testable outside the extension runtime).
 */
export function createLogger(namespace, isDebugEnabled = () => false) {
  const prefix = `[CalendarAssistant:${namespace}]`;
  return {
    debug(...args) {
      if (isDebugEnabled()) console.debug(prefix, ...args);
    },
    info(...args) {
      if (isDebugEnabled()) console.info(prefix, ...args);
    },
    warn(...args) {
      console.warn(prefix, ...args);
    },
    error(...args) {
      console.error(prefix, ...args);
    }
  };
}
