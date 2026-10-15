import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocketEmitterService } from '../../common/services/socket-emitter.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly socketEmitter: SocketEmitterService,
  ) {}

  // ─── Reports ──────────────────────────────────────────────

  async getReports(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reporter: { select: { id: true, anonAlias: true, region: true } },
          reported: { select: { id: true, anonAlias: true, region: true, isBanned: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateReportStatus(id: string, status: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return this.prisma.report.update({ where: { id }, data: { status } });
  }

  // ─── Users ────────────────────────────────────────────────

  async getUsers(page = 1, limit = 20, search?: string, gender?: string, region?: string, isLinked?: boolean) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { anonAlias: { contains: search } },
        { region: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (gender === 'male' || gender === 'female') {
      where.gender = gender;
    }
    if (region) {
      where.region = region;
    }
    if (isLinked !== undefined) {
      where.isLinked = isLinked;
    }
    const [data, total, maleCount, femaleCount, linkedCount, anonymousCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          anonAlias: true,
          email: true,
          region: true,
          gender: true,
          interests: true,
          isBanned: true,
          banUntil: true,
          isPremium: true,
          isLinked: true,
          lastActiveAt: true,
          createdAt: true,
          _count: { select: { sentReports: true, receivedReports: true } },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { gender: 'male' } }),
      this.prisma.user.count({ where: { gender: 'female' } }),
      this.prisma.user.count({ where: { isLinked: true } }),
      this.prisma.user.count({ where: { isLinked: false } }),
    ]);
    return { data, total, page, limit, maleCount, femaleCount, linkedCount, anonymousCount };
  }

  async getUserRegions() {
    const rows = await this.prisma.user.findMany({
      where: { region: { not: null } },
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    });
    return rows.map(r => r.region).filter(Boolean) as string[];
  }

  async banUser(userId: string, reason?: string, banIp = true) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id: userId }, data: { isBanned: true } });

    // Ban user's IP from their latest session
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

    // Invalidate all sessions
    await this.prisma.session.deleteMany({ where: { userId } });

    return { success: true };
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: userId }, data: { isBanned: false, banUntil: null } });
    return { success: true };
  }

  async cancelSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isPremium) throw new BadRequestException('User does not have an active subscription');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isPremium: false, premiumUntil: null },
    });

    await this.notificationsService.create(
      userId,
      'subscription_cancelled',
      'Subscription Cancelled',
      'Your premium subscription has been cancelled by an administrator.',
    );

    return { success: true };
  }

  async setPremium(userId: string, isPremium: boolean, plan?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (isPremium) {
      const days = plan === '7day' ? 7 : plan === '15day' ? 15 : 30;
      const premiumUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await this.prisma.user.update({ where: { id: userId }, data: { isPremium: true, premiumUntil } });
      await this.notificationsService.create(userId, 'subscription_approved', 'Premium Activated!', `Your premium has been granted by an administrator (${plan ?? '30day'} plan).`);
      this.socketEmitter.emitToUser(userId, 'user:premium-updated', { isPremium: true, premiumUntil });
    } else {
      await this.prisma.user.update({ where: { id: userId }, data: { isPremium: false, premiumUntil: null } });
      await this.notificationsService.create(userId, 'subscription_cancelled', 'Subscription Cancelled', 'Your premium subscription has been removed by an administrator.');
      this.socketEmitter.emitToUser(userId, 'user:premium-updated', { isPremium: false, premiumUntil: null });
    }

    return { success: true };
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
    return this.prisma.ipBan.upsert({
      where: { ip },
      create: { ip, reason },
      update: { reason },
    });
  }

  async removeIpBan(id: string) {
    const ban = await this.prisma.ipBan.findUnique({ where: { id } });
    if (!ban) throw new NotFoundException('IP ban not found');
    await this.prisma.ipBan.delete({ where: { id } });
    return { success: true };
  }

  // ─── Payments ─────────────────────────────────────────────

  async getPayments(status?: string, page = 1, limit = 20, plan?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (plan) where.plan = plan;
    const [data, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, anonAlias: true } },
        },
      }),
      this.prisma.paymentRequest.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async approvePayment(id: string, planOverride?: string) {
    const payment = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment request not found');
    if (payment.status !== 'pending') throw new BadRequestException('Payment already reviewed');

    const plan = planOverride ?? payment.plan;
    const now = new Date();
    const days =
      plan === '7day' || plan === 'weekly' ? 7 :
      plan === '15day' ? 15 :
      30; // '30day' | 'monthly' | fallback
    const premiumUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.paymentRequest.update({
      where: { id },
      data: { status: 'approved', reviewedAt: now },
    });

    await this.prisma.user.update({
      where: { id: payment.userId },
      data: { isPremium: true, premiumUntil },
    });

    await this.notificationsService.create(
      payment.userId,
      'subscription_approved',
      'Subscription Activated!',
      `Your ${plan} premium subscription has been activated. Enjoy premium features!`,
    );

    return { success: true };
  }

  async rejectPayment(id: string, note?: string) {
    const payment = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment request not found');
    if (payment.status !== 'pending') throw new BadRequestException('Payment already reviewed');

    await this.prisma.paymentRequest.update({
      where: { id },
      data: { status: 'rejected', reviewedAt: new Date(), reviewNote: note ?? null },
    });

    await this.notificationsService.create(
      payment.userId,
      'subscription_rejected',
      'Payment Rejected',
      note ? `Your payment request was rejected: ${note}` : 'Your payment request was rejected. Please contact support.',
    );

    return { success: true };
  }

  // ─── User IP Info ─────────────────────────────────────────

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
    if (!user) throw new Error('User not found');

    const ips = user.sessions
      .map(s => (s.deviceInfo as { ip?: string })?.ip)
      .filter((ip): ip is string => !!ip);

    const uniqueIps = [...new Set(ips)];

    return {
      deviceId: user.deviceId,
      ips: uniqueIps,
      latestIp: uniqueIps[0] ?? null,
    };
  }

  // ─── Posts ────────────────────────────────────────────────

  async getPosts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, anonAlias: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      this.prisma.post.count(),
    ]);
    return { data, total, page, limit };
  }

  async deletePost(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  // ─── Calls ────────────────────────────────────────────────

  async getCalls(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.call.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          userA: { select: { id: true, anonAlias: true } },
          userB: { select: { id: true, anonAlias: true } },
        },
      }),
      this.prisma.call.count(),
    ]);
    return { data, total, page, limit };
  }

  // ─── Stats ────────────────────────────────────────────────

  async getStats() {
    const [users, bannedUsers, openReports, ipBans, totalCalls, durationAgg, maleUsers, femaleUsers, revenueAgg, revenue7day, revenue15day, revenue30day, premiumUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.ipBan.count(),
      this.prisma.call.count(),
      this.prisma.call.aggregate({ _sum: { durationSecs: true } }),
      this.prisma.user.count({ where: { gender: 'male' } }),
      this.prisma.user.count({ where: { gender: 'female' } }),
      this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { status: 'approved' } }),
      this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { status: 'approved', plan: '7day' } }),
      this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { status: 'approved', plan: '15day' } }),
      this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { status: 'approved', plan: '30day' } }),
      this.prisma.user.count({ where: { isPremium: true } }),
    ]);
    const totalMinutes = Math.floor((durationAgg._sum.durationSecs ?? 0) / 60);
    const totalRevenue = revenueAgg._sum.amount ?? 0;
    const revenueByPlan = {
      '7day': revenue7day._sum.amount ?? 0,
      '15day': revenue15day._sum.amount ?? 0,
      '30day': revenue30day._sum.amount ?? 0,
    };
    return { users, bannedUsers, openReports, ipBans, totalCalls, totalMinutes, maleUsers, femaleUsers, totalRevenue, revenueByPlan, premiumUsers };
  }

  async resetAllUsers() {
    // Delete in FK-safe order. Cascade handles Session, PaymentRequest, Notification.
    await this.prisma.$transaction([
      this.prisma.sharedImage.deleteMany(),
      this.prisma.call.deleteMany(),
      this.prisma.friend.deleteMany(),
      this.prisma.report.deleteMany(),
      this.prisma.block.deleteMany(),
      this.prisma.subscription.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
    return { success: true };
  }

  async getDailyStats(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const [calls, users] = await Promise.all([
      this.prisma.call.findMany({
        where: { startedAt: { gte: since } },
        select: { startedAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const callMap: Record<string, number> = {};
    for (const c of calls) {
      const key = c.startedAt.toISOString().split('T')[0];
      callMap[key] = (callMap[key] ?? 0) + 1;
    }

    const userMap: Record<string, number> = {};
    for (const u of users) {
      const key = u.createdAt.toISOString().split('T')[0];
      userMap[key] = (userMap[key] ?? 0) + 1;
    }

    const result: { date: string; calls: number; users: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      result.push({ date: key, calls: callMap[key] ?? 0, users: userMap[key] ?? 0 });
    }

    return result;
  }
}
