import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AddFriendDto } from './dto/friend.dto';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFriends(userId: string) {
    const [records, unreadCounts, allMessages] = await Promise.all([
      this.prisma.friend.findMany({
        where: { userId, status: 'accepted' },
        include: {
          friend: { select: { id: true, anonAlias: true, region: true, gender: true, lastActiveAt: true, isPremium: true, isLinked: true, interests: true } },
        },
        orderBy: { addedAt: 'desc' },
      }),
      this.prisma.chatMessage.groupBy({
        by: ['fromUserId'],
        where: { toUserId: userId, read: false },
        _count: { id: true },
      }),
      this.prisma.chatMessage.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        orderBy: { createdAt: 'desc' },
        select: { id: true, fromUserId: true, toUserId: true, text: true, createdAt: true },
      }),
    ]);

    const unreadMap = new Map(unreadCounts.map(r => [r.fromUserId, r._count.id]));

    // Pick the latest message per friend pair
    const lastMsgMap = new Map<string, { text: string; createdAt: Date; fromMe: boolean }>();
    for (const msg of allMessages) {
      const partnerId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      if (!lastMsgMap.has(partnerId)) {
        lastMsgMap.set(partnerId, { text: msg.text, createdAt: msg.createdAt, fromMe: msg.fromUserId === userId });
      }
    }

    return records.map(r => {
      const lm = lastMsgMap.get(r.friendId);
      return {
        id: r.friendId,
        alias: r.friend.anonAlias,
        region: r.friend.region,
        gender: r.friend.gender ?? null,
        isPremium: r.friend.isPremium,
        isLinked: r.friend.isLinked,
        interests: r.friend.interests,
        nickname: r.nickname,
        status: r.status,
        addedAt: r.addedAt,
        lastCallAt: r.lastCallAt,
        lastActiveAt: r.friend.lastActiveAt ?? null,
        unreadCount: unreadMap.get(r.friendId) ?? 0,
        lastMessage: lm ? { text: lm.text, createdAt: lm.createdAt.toISOString(), fromMe: lm.fromMe } : null,
      };
    });
  }

  async getIncomingRequests(userId: string) {
    const records = await this.prisma.friend.findMany({
      where: { friendId: userId, status: 'pending' },
      include: { user: { select: { id: true, anonAlias: true } } },
      orderBy: { addedAt: 'desc' },
    });
    return records.map(r => ({
      id: r.userId,
      alias: r.user.anonAlias,
      sentAt: r.addedAt,
    }));
  }

  async createPendingRequest(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) return;
    const existing = await this.prisma.friend.findUnique({
      where: { userId_friendId: { userId, friendId: targetId } },
    });
    if (existing?.status === 'accepted') return; // already friends
    if (existing?.status === 'pending') return;  // request already in flight
    if (existing) {
      // was previously rejected — allow re-request
      await this.prisma.friend.update({
        where: { userId_friendId: { userId, friendId: targetId } },
        data: { status: 'pending' },
      });
    } else {
      await this.prisma.friend.create({
        data: { userId, friendId: targetId, status: 'pending' },
      });
    }
  }

  async acceptRequest(requesterId: string, userId: string): Promise<void> {
    await this.prisma.friend.updateMany({
      where: { userId: requesterId, friendId: userId, status: 'pending' },
      data: { status: 'accepted' },
    });
    await this.prisma.friend.upsert({
      where: { userId_friendId: { userId, friendId: requesterId } },
      update: { status: 'accepted' },
      create: { userId, friendId: requesterId, status: 'accepted' },
    });
  }

  async rejectRequest(requesterId: string, userId: string): Promise<void> {
    await this.prisma.friend.updateMany({
      where: { userId: requesterId, friendId: userId, status: 'pending' },
      data: { status: 'rejected' },
    });
  }

  async addFriend(userId: string, dto: AddFriendDto) {
    if (userId === dto.friendId) {
      throw new ConflictException('Cannot add yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: dto.friendId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.prisma.friend.findUnique({
      where: { userId_friendId: { userId, friendId: dto.friendId } },
    });
    if (existing) throw new ConflictException('Already added');

    const record = await this.prisma.friend.create({
      data: {
        userId,
        friendId: dto.friendId,
        nickname: dto.nickname,
        status: 'accepted',
      },
      include: { friend: { select: { id: true, anonAlias: true, region: true } } },
    });

    return {
      id: record.friendId,
      alias: record.friend.anonAlias,
      region: record.friend.region,
      nickname: record.nickname,
      status: record.status,
      addedAt: record.addedAt,
    };
  }

  async removeFriend(userId: string, friendId: string) {
    const record = await this.prisma.friend.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    if (!record) throw new NotFoundException('Friend not found');

    await this.prisma.friend.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
  }

  async getChatHistory(userId: string, friendId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return messages.map(m => ({
      id: m.id,
      fromUserId: m.fromUserId,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async markMessagesRead(userId: string, friendId: string): Promise<void> {
    await this.prisma.chatMessage.updateMany({
      where: { fromUserId: friendId, toUserId: userId, read: false },
      data: { read: true },
    });
  }
}
