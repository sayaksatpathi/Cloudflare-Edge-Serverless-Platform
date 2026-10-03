import { d1First, d1Run } from '../bindings/d1';
import { hashPassword, verifyPassword, signToken } from '../utils/crypto';
import { generateId } from '../utils/ids';
import { validateEmail, validatePassword } from '../utils/validation';
import { ConflictError, AuthError } from '../utils/errors';
import type { User, AuthToken, AuthResponse, RegisterRequest, LoginRequest, Env } from '../types';
import { getConfig } from '../config';

export async function registerUser(
  env: Env,
  body: RegisterRequest,
): Promise<AuthResponse> {
  validateEmail(body.email);
  validatePassword(body.password);

  const email = body.email.toLowerCase().trim();

  // Check for duplicate email
  const existing = await d1First<User>(env.DB, 'SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    throw new ConflictError('Email already registered', 'EMAIL_EXISTS');
  }

  const id = generateId();
  const password_hash = await hashPassword(body.password);
  const now = new Date().toISOString();

  await d1Run(
    env.DB,
    'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, email, password_hash, now, now],
  );

  const config = getConfig(env);
  const token = await signToken(
    {
      user_id: id,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.tokenExpirySecs,
    } satisfies AuthToken,
    config.jwtSecret,
  );

  return {
    token,
    user: { id, email, created_at: now },
  };
}

export async function loginUser(env: Env, body: LoginRequest): Promise<AuthResponse> {
  const email = body.email.toLowerCase().trim();

  const user = await d1First<User>(
    env.DB,
    'SELECT id, email, password_hash, created_at FROM users WHERE email = ?',
    [email],
  );

  if (!user) {
    // Constant-time response to prevent user enumeration
    await hashPassword('dummy-prevent-timing-attack');
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const config = getConfig(env);
  const token = await signToken(
    {
      user_id: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.tokenExpirySecs,
    } satisfies AuthToken,
    config.jwtSecret,
  );

  return {
    token,
    user: { id: user.id, email: user.email, created_at: user.created_at },
  };
}

export async function getMe(env: Env, userId: string): Promise<Omit<User, 'password_hash'>> {
  const user = await d1First<Omit<User, 'password_hash'>>(
    env.DB,
    'SELECT id, email, created_at, updated_at FROM users WHERE id = ?',
    [userId],
  );
  if (!user) throw new AuthError('User not found', 'USER_NOT_FOUND');
  return user;
}
