// Telemetry abstraction for EdgeForge
// Uses Cloudflare Workers native observability (console.log → structured logs)
// OpenTelemetry integration is documented but requires OTEL exporter configuration

export interface SpanData {
  name: string;
  request_id: string;
  start_ms: number;
  end_ms?: number;
  attributes?: Record<string, string | number | boolean>;
  status?: 'ok' | 'error';
  error?: string;
}

export class Span {
  private start_ms: number;
  private data: SpanData;

  constructor(name: string, request_id: string, attributes?: Record<string, string | number | boolean>) {
    this.start_ms = Date.now();
    this.data = {
      name,
      request_id,
      start_ms: this.start_ms,
      attributes,
    };
  }

  end(status: 'ok' | 'error' = 'ok', error?: string): SpanData {
    this.data.end_ms = Date.now();
    this.data.status = status;
    if (error) this.data.error = error;
    return this.data;
  }

  durationMs(): number {
    return Date.now() - this.start_ms;
  }
}

export function startSpan(
  name: string,
  request_id: string,
  attributes?: Record<string, string | number | boolean>,
): Span {
  return new Span(name, request_id, attributes);
}

// Metrics counters — emitted as structured log entries
// In production, these feed Cloudflare Workers Analytics Engine or external OTEL
export type MetricName =
  | 'request_total'
  | 'request_error'
  | 'asset_upload'
  | 'asset_download'
  | 'asset_delete'
  | 'job_created'
  | 'job_success'
  | 'job_failed'
  | 'cache_hit'
  | 'cache_miss'
  | 'rate_limited'
  | 'd1_error'
  | 'r2_error'
  | 'queue_error'
  | 'scheduled_run'
  | 'scheduled_error';

export function emitMetric(
  metric: MetricName,
  value: number,
  tags?: Record<string, string>,
): void {
  console.log(
    JSON.stringify({
      _type: 'metric',
      metric,
      value,
      timestamp: new Date().toISOString(),
      tags,
    }),
  );
}
