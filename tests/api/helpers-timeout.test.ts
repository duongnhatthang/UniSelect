import { describe, it, expect, vi } from 'vitest';

// RED phase: these imports will fail until implementation files exist
import { withTimeout } from '../../lib/db/timeout';
import { errorResponse } from '../../lib/api/helpers';

describe('withTimeout', () => {
  it('resolves when promise completes before deadline', async () => {
    const promise = Promise.resolve('done');
    const result = await withTimeout(promise, 5000);
    expect(result).toBe('done');
  });

  it('rejects with Error("DB_TIMEOUT") when promise exceeds deadline', async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<string>(() => {});
    const raced = withTimeout(neverResolves, 100);
    vi.advanceTimersByTime(200);
    await expect(raced).rejects.toThrow('DB_TIMEOUT');
    vi.useRealTimers();
  });

  it('rejects with an Error instance (not just a string)', async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<string>(() => {});
    const raced = withTimeout(neverResolves, 100);
    vi.advanceTimersByTime(200);
    await expect(raced).rejects.toBeInstanceOf(Error);
    vi.useRealTimers();
  });
});

describe('errorResponse', () => {
  it('returns Response with correct status', async () => {
    const res = errorResponse('TEST_CODE', 'test message', 400);
    expect(res.status).toBe(400);
  });

  it('returns JSON body with { error: { code, message } } shape', async () => {
    const res = errorResponse('INVALID_PARAMS', 'bad input', 400);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'INVALID_PARAMS', message: 'bad input' } });
  });

  it('includes optional extra headers when provided', async () => {
    const res = errorResponse('DB_UNAVAILABLE', 'Service temporarily unavailable', 503, { 'Retry-After': '30' });
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.status).toBe(503);
  });

  it('works without extra headers (undefined extraHeaders)', async () => {
    const res = errorResponse('NOT_FOUND', 'Not found', 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
