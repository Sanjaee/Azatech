import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtUserPayload } from '../types';
import { UnauthorizedError } from '../utils/errors';

export function signAccessToken(payload: Omit<JwtUserPayload, 'iat' | 'exp'>): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtUserPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      throw new UnauthorizedError('Invalid authentication token');
    }
    const payload = decoded as JwtUserPayload;
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedError('Invalid token payload');
    }
    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
}
