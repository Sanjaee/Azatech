import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { users } from '../../db/schema';
import { signAccessToken } from '../../lib/jwt';
import { UnauthorizedError } from '../../utils/errors';
import { LoginInput } from './auth.schema';

export class AuthService {
  async login(input: LoginInput) {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('User account no longer exists');
    }

    return user;
  }
}

export const authService = new AuthService();
