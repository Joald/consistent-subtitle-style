import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debug } from '../src/debug.js';

describe('debug module', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      /* noop */
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when DEBUG is true', () => {
    beforeEach(() => {
      vi.stubGlobal('DEBUG', true);
    });

    it('logs messages', () => {
      debug.log('test message');
      expect(logSpy).toHaveBeenCalledWith('test message');
    });

    it('logs errors', () => {
      debug.error('test error');
      expect(errorSpy).toHaveBeenCalledWith('test error');
    });

    it('logs warnings', () => {
      debug.warn('test warning');
      expect(warnSpy).toHaveBeenCalledWith('test warning');
    });
  });

  describe('when DEBUG is false', () => {
    beforeEach(() => {
      vi.stubGlobal('DEBUG', false);
    });

    it('does not log messages', () => {
      debug.log('test message');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('does not log errors', () => {
      debug.error('test error');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not log warnings', () => {
      debug.warn('test warning');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
