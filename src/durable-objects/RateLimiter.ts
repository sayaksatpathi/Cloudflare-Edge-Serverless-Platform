// RateLimiter Durable Object
// One instance per user/IP — provides strong per-entity rate limiting
// Uses actual Durable Object state for coordination, not KV

interface State {
  count: number;
  window_start: number;
}

export class RateLimiter {
  private state: DurableObjectState;
  private data: State = { count: 0, window_start: 0 };

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    let body: { limit: number; window_secs: number };
    try {
      body = (await request.json()) as { limit: number; window_secs: number };
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { limit, window_secs } = body;
    const now = Math.floor(Date.now() / 1000);

    // Load persisted state
    const stored = await this.state.storage.get<State>('state');
    if (stored) {
      this.data = stored;
    }

    // Reset if window expired
    if (now - this.data.window_start >= window_secs) {
      this.data = { count: 0, window_start: now };
    }

    const allowed = this.data.count < limit;
    const reset_at = this.data.window_start + window_secs;

    if (allowed) {
      this.data.count += 1;
      // Persist atomically
      await this.state.storage.put('state', this.data);
    }

    const remaining = Math.max(0, limit - this.data.count);

    return new Response(
      JSON.stringify({
        allowed,
        remaining,
        reset_at,
        count: this.data.count,
        limit,
      }),
      {
        status: allowed ? 200 : 429,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
