import { describe, it, expect } from 'vitest';
import { publicCacheHeaders, privateCacheHeaders } from '../../src/services/cache-service';

describe('Cache headers', () => {
  it('publicCacheHeaders sets correct Cache-Control', () => {
    const headers = publicCacheHeaders(300);
    expect(headers['Cache-Control']).toContain('public');
    expect(headers['Cache-Control']).toContain('max-age=300');
    expect(headers['Cache-Control']).toContain('s-maxage=300');
  });

  it('privateCacheHeaders disables caching', () => {
    const headers = privateCacheHeaders();
    expect(headers['Cache-Control']).toContain('private');
    expect(headers['Cache-Control']).toContain('no-store');
    expect(headers['Cache-Control']).toContain('no-cache');
  });

  it('private headers prevent CDN caching', () => {
    const headers = privateCacheHeaders();
    // Must not contain "public" or "s-maxage"
    expect(headers['Cache-Control']).not.toContain('public');
    expect(headers['Cache-Control']).not.toContain('s-maxage');
  });
});
