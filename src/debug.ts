declare const DEBUG: boolean;

export const debug = {
  log: (...args: unknown[]): void => {
    if (DEBUG) console.log(...args);
  },
  error: (...args: unknown[]): void => {
    if (DEBUG) console.error(...args);
  },
  warn: (...args: unknown[]): void => {
    if (DEBUG) console.warn(...args);
  },
};
