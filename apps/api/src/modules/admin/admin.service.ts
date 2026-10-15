import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Users ────────────────────────────────────────────────

  async getUsers(page = 1, limit = 20, search?: string, isLinked?: boolean) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { anonAlias: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isLinked !== undefined) {
      where.isLinked = isLinked;
    }
    const [data, total, linkedCount, guestCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          anonAlias: true,
          email: true,
          isLinked: true,
          isBanned: true,
          banUntil: true,
          lastActiveAt: true,
          createdAt: true,
          _count: { select: { meetingsHosted: true, meetingParticipations: true } },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { isLinked: true } }),
      this.prisma.user.count({ where: { isLinked: false } }),
    ]);
    return { data, total, page, limit, linkedCount, guestCount };
  }

  async banUser(userId: string, reason?: string, banIp = true) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id: userId }, data: { isBanned: true } });

    if (banIp && user.sessions.length > 0) {
      const deviceInfo = user.sessions[0].deviceInfo as { ip?: string };
      const ip = deviceInfo?.ip;
      if (ip) {
        await this.prisma.ipBan.upsert({
          where: { ip },
          create: { ip, reason: reason ?? `Banned user ${user.anonAlias}` },
          update: { reason: reason ?? `Banned user ${user.anonAlias}` },
        });
      }
    }

    await this.prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: userId }, data: { isBanned: false, banUntil: null } });
    return { success: true };
  }

  async getUserIpInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        deviceId: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { deviceInfo: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const ips = user.sessions
      .map((s) => (s.deviceInfo as { ip?: string })?.ip)
      .filter((ip): ip is string => !!ip);
    const uniqueIps = [...new Set(ips)];

    return { deviceId: user.deviceId, ips: uniqueIps, latestIp: uniqueIps[0] ?? null };
  }

  // ─── Meetings ─────────────────────────────────────────────

  async getMeetings(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.meeting.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          host: { select: { id: true, anonAlias: true, email: true } },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.meeting.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getMeetingParticipants(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: { id: true, anonAlias: true, email: true, isLinked: true } } },
    });
  }

  // ─── IP Bans ──────────────────────────────────────────────

  async getIpBans(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.ipBan.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.ipBan.count(),
    ]);
    return { data, total, page, limit };
  }

  async addIpBan(ip: string, reason?: string) {
    return this.prisma.ipBan.upsert({ where: { ip }, create: { ip, reason }, update: { reason } });
  }

  async removeIpBan(id: string) {
    const ban = await this.prisma.ipBan.findUnique({ where: { id } });
    if (!ban) throw new NotFoundException('IP ban not found');
    await this.prisma.ipBan.delete({ where: { id } });
    return { success: true };
  }

  // ─── Stats ────────────────────────────────────────────────

  async getStats() {
    const [users, linkedUsers, guestUsers, bannedUsers, ipBans, liveMeetings, totalMeetings] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isLinked: true } }),
      this.prisma.user.count({ where: { isLinked: false } }),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.ipBan.count(),
      this.prisma.meeting.count({ where: { status: 'live' } }),
      this.prisma.meeting.count(),
    ]);
    return { users, linkedUsers, guestUsers, bannedUsers, ipBans, liveMeetings, totalMeetings };
  }

  async resetAllUsers() {
    await this.prisma.$transaction([
      this.prisma.meetingParticipant.deleteMany(),
      this.prisma.meeting.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
    return { success: true };
  }
}
