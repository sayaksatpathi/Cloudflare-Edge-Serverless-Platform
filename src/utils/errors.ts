export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Unauthorized', code = 'AUTH_REQUIRED') {
    super(401, message, code);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, message, code);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource', code = 'NOT_FOUND') {
    super(404, `${resource} not found`, code);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(400, message, code);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(
    public readonly resetAt: number,
    public readonly remaining: number,
  ) {
    super(429, 'Too Many Requests', 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, message, code);
    this.name = 'ConflictError';
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(maxBytes: number) {
    super(413, `Payload too large. Maximum size is ${maxBytes} bytes`, 'PAYLOAD_TOO_LARGE');
    this.name = 'PayloadTooLargeError';
  }
}

export class UnsupportedMediaTypeError extends ApiError {
  constructor(contentType: string) {
    super(415, `Unsupported content type: ${contentType}`, 'UNSUPPORTED_MEDIA_TYPE');
    this.name = 'UnsupportedMediaTypeError';
  }
}
