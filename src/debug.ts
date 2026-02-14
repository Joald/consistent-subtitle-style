declare const DEBUG: boolean;

export const debug = {
  log: (...args: any[]) => { if (DEBUG) console.log(...args); },
  error: (...args: any[]) => { if (DEBUG) console.error(...args); },
  warn: (...args: any[]) => { if (DEBUG) console.warn(...args); }
};