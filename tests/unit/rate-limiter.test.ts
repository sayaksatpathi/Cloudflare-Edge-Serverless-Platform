import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter } from '../../src/durable-objects/RateLimiter';

// Mock DurableObjectState
function makeMockState() {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: unknown) => { store.set(key, value); },
    },
  } as unknown as DurableObjectState;
}

function makeRequest(body: object): Request {
  return new Request('https://rate-limiter/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('RateLimiter Durable Object', () => {
  it('allows requests under the limit', async () => {
    const rl = new RateLimiter(makeMockState());
    const req = makeRequest({ limit: 5, window_secs: 60 });
    const res = await rl.fetch(req);
    const data = await res.json() as { allowed: boolean; remaining: number };
    expect(res.status).toBe(200);
    expect(data.allowed).toBe(true);
    expect(data.remaining).toBe(4);
  });

  it('blocks requests over the limit', async () => {
    const state = makeMockState();
    const rl = new RateLimiter(state);
    const limit = 3;

    for (let i = 0; i < limit; i++) {
      await rl.fetch(makeRequest({ limit, window_secs: 60 }));
    }

    const res = await rl.fetch(makeRequest({ limit, window_secs: 60 }));
    const data = await res.json() as { allowed: boolean; remaining: number };
    expect(res.status).toBe(429);
    expect(data.allowed).toBe(false);
    expect(data.remaining).toBe(0);
  });

  it('resets after window expires', async () => {
    const store = new Map<string, unknown>();
    // Pre-seed state from 2 minutes ago
    const pastStart = Math.floor(Date.now() / 1000) - 120;
    store.set('state', { count: 100, window_start: pastStart });
    const state = {
      storage: {
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: unknown) => { store.set(key, value); },
      },
    } as unknown as DurableObjectState;

    const rl = new RateLimiter(state);
    const res = await rl.fetch(makeRequest({ limit: 10, window_secs: 60 }));
    const data = await res.json() as { allowed: boolean };
    expect(data.allowed).toBe(true);
  });

  it('returns 405 for non-POST requests', async () => {
    const rl = new RateLimiter(makeMockState());
    const req = new Request('https://rate-limiter/check', { method: 'GET' });
    const res = await rl.fetch(req);
    expect(res.status).toBe(405);
  });

  it('returns 400 for invalid JSON', async () => {
    const rl = new RateLimiter(makeMockState());
    const req = new Request('https://rate-limiter/check', {
      method: 'POST',
      body: 'not json',
    });
    const res = await rl.fetch(req);
    expect(res.status).toBe(400);
  });
});
