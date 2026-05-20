import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersMobileService {
  constructor(private readonly prisma: PrismaService) {}

  async registerFcmToken(actor: AuthUser, token: string): Promise<{ ok: true }> {
    const trimmed = token.trim();
    if (!trimmed) throw new NotFoundException('token is required');
    const user = await this.prisma.user.findFirst({
      where: { id: actor.userId, institutionId: actor.institutionId, deletedAt: null },
      select: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const profile =
      user.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)
        ? { ...(user.profile as Record<string, unknown>) }
        : {};
    const existing = Array.isArray(profile.fcmTokens)
      ? (profile.fcmTokens as string[]).filter((t) => typeof t === 'string')
      : typeof profile.fcmToken === 'string' && profile.fcmToken.trim()
        ? [profile.fcmToken.trim()]
        : [];
    const tokens = [...new Set([...existing, trimmed])].slice(-10);
    await this.prisma.user.update({
      where: { id: actor.userId },
      data: {
        profile: {
          ...profile,
          fcmTokens: tokens,
          fcmToken: tokens[tokens.length - 1],
        },
      },
    });
    return { ok: true };
  }
}
