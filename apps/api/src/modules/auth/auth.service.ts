import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import * as geoip from 'geoip-lite';
import type { GoogleProfile } from './strategies/google.strategy';

const ADJECTIVES = [
  'Swift', 'Bold', 'Bright', 'Cool', 'Daring', 'Eager', 'Fierce', 'Grand',
  'Happy', 'Jolly', 'Keen', 'Lively', 'Mighty', 'Noble', 'Proud', 'Quick',
  'Radiant', 'Sharp', 'Tough', 'Vivid', 'Warm', 'Zesty', 'Calm', 'Witty',
];

const NOUNS = [
  'Mango', 'Tiger', 'Eagle', 'Panda', 'Falcon', 'Storm', 'River', 'Ocean',
  'Comet', 'Blaze', 'Shadow', 'Thunder', 'Breeze', 'Spark', 'Drift', 'Bloom',
  'Flame', 'Pulse', 'Surge', 'Vibe', 'Wave', 'Glow', 'Frost', 'Cloud',
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashFingerprint(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private generateAlias(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${adj}${noun}#${num}`;
  }

  private generateTokenPair(userId: string) {
    const jti = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const accessToken = this.jwtService.sign(
      { sub: userId, type: 'access', jti },
      { expiresIn: this.config.get<string>('jwt.accessExpires') },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh', jti },
      { expiresIn: this.config.get<string>('jwt.refreshExpires') },
    );

    return { accessToken, refreshToken };
  }

  async init(deviceFingerprint: string, deviceInfo: Prisma.InputJsonValue, clientIp?: string) {
    // Check IP ban first
    if (clientIp) {
      const ipBan = await this.prisma.ipBan.findFirst({
        where: {
          ip: clientIp,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (ipBan) throw new ConflictException('This device is banned');
    }

    const deviceId = this.hashFingerprint(deviceFingerprint);

    let user = await this.prisma.user.findUnique({ where: { deviceId } });
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: { deviceId, anonAlias: this.generateAlias(), interests: [] },
        });
      } catch (e: any) {
        // Race condition: another concurrent request just created this user
        if (e?.code === 'P2002') {
          user = await this.prisma.user.findUnique({ where: { deviceId } });
        }
        if (!user) throw e;
      }
    }

    if (user.isBanned) {
      throw new ConflictException('This device is banned');
    }

    // Auto-detect region from IP
    if (clientIp) {
      const cleanIp = clientIp.startsWith('::ffff:') ? clientIp.slice(7) : clientIp;
      const isLocal = cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.');
      let detectedRegion: string | null = isLocal ? 'BD' : null;

      if (!isLocal) {
        // Try ip-api.com first (more accurate, free)
        try {
          const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=countryCode,status`, { signal: AbortSignal.timeout(3000) });
          const data = await res.json() as { status: string; countryCode: string };
          if (data.status === 'success' && data.countryCode) {
            detectedRegion = data.countryCode;
          }
        } catch {
          // Fallback to local geoip-lite
          const geo = geoip.lookup(cleanIp);
          if (geo?.country) detectedRegion = geo.country;
        }
      }

      if (detectedRegion) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { region: detectedRegion },
        });
        user = { ...user, region: detectedRegion };
      }
    }

    const tokens = this.generateTokenPair(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Delete old sessions for this user then create fresh one
    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    await this.prisma.session.create({
      data: { userId: user.id, token: tokens.refreshToken, deviceInfo, expiresAt },
    });

    return { tokens, user };
  }

  async deleteAccount(userId: string) {
    // Delete in dependency order to avoid FK constraint violations
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.notification.deleteMany({ where: { userId } });
    await this.prisma.paymentRequest.deleteMany({ where: { userId } });
    await this.prisma.sharedImage.deleteMany({
      where: { call: { OR: [{ participantA: userId }, { participantB: userId }] } },
    });
    await this.prisma.call.deleteMany({
      where: { OR: [{ participantA: userId }, { participantB: userId }] },
    });
    await this.prisma.friend.deleteMany({
      where: { OR: [{ userId }, { friendId: userId }] },
    });
    await this.prisma.report.deleteMany({
      where: { OR: [{ reporterId: userId }, { reportedId: userId }] },
    });
    await this.prisma.block.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    await this.prisma.subscription.deleteMany({ where: { userId } });
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; type: string };

    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.prisma.session.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    if (session.user.isBanned) {
      throw new UnauthorizedException('Account banned');
    }

    const tokens = this.generateTokenPair(session.userId);

    // Use updateMany to avoid P2025 if session was concurrently deleted (race condition)
    await this.prisma.session.updateMany({
      where: { id: session.id },
      data: { token: tokens.refreshToken },
    });

    return { tokens, user: session.user };
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  /**
   * Called after Google OAuth callback.
   *
   * Flow:
   *  1. Does a user with this googleId already exist? → login, return tokens
   *  2. Brand-new Google user → create new linked account (completely separate from anonymous)
   *
   * Anonymous accounts and Google accounts are fully separate — no merging.
   */
  async googleAuth(
    profile: GoogleProfile,
    deviceInfo: Prisma.InputJsonValue,
  ) {
    const { googleId, email } = profile;

    // 1. User with this googleId already exists — just log them in
    const existingByGoogle = await this.prisma.user.findUnique({ where: { googleId } });
    if (existingByGoogle) {
      const tokens = this.generateTokenPair(existingByGoogle.id);
      await this.createSession(existingByGoogle.id, tokens.refreshToken, deviceInfo);
      const user = await this.prisma.user.findUnique({ where: { id: existingByGoogle.id } });
      return { tokens, user };
    }

    // 2. Brand-new Google user — create fresh linked account
    const newUser = await this.prisma.user.create({
      data: {
        deviceId: `google_${googleId}`,
        googleId,
        email: email || null,
        isLinked: true,
        anonAlias: this.generateAlias(),
        interests: [],
      },
    });
    const tokens = this.generateTokenPair(newUser.id);
    await this.createSession(newUser.id, tokens.refreshToken, deviceInfo);
    return { tokens, user: newUser };
  }

  async oneTapAuth(credential: string, deviceInfo: Prisma.InputJsonValue) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OAuth2Client } = require('google-auth-library');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const profile: GoogleProfile = {
      googleId: payload.sub,
      email: payload.email ?? '',
      displayName: payload.name ?? '',
    };
    return this.googleAuth(profile, deviceInfo);
  }

  async logout(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    deviceInfo: Prisma.InputJsonValue,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.session.create({
      data: { userId, token: refreshToken, deviceInfo, expiresAt },
    });
  }
}
