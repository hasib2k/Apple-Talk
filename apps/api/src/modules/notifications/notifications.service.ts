import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SocketEmitterService } from '../../common/services/socket-emitter.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketEmitter: SocketEmitterService,
  ) {}

  async create(userId: string, type: string, title: string, body: string) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body },
    });
    this.socketEmitter.emitToUser(userId, 'notification:new', notification);
    return notification;
  }

  async getForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
