import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '../../common/decorators/inject-redis.decorator';
import Redis from 'ioredis';
import { PrismaService } from '../../common/services/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface QueueEntry {
  userId: string;
  alias: string;
  interests: string[];
  region: string | null;
  gender: string | null;
  isPremium: boolean;
  isLinked: boolean;
  joinedAt: number;
  socketId: string;
  purpose?: string;
  wantGender?: string | null;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async joinQueue(entry: QueueEntry): Promise<void> {
    // Remove any stale entries for this user first (handles reconnect + React StrictMode double-invoke)
    await this.leaveQueue(entry.userId);
    const score = entry.isPremium ? entry.joinedAt - 1_000_000_000_000 : entry.joinedAt;
    await this.redis.zadd('queue:ANY', score, JSON.stringify(entry));
    this.logger.debug(`User ${entry.userId} joined queue [${entry.region ?? 'ANY'}]`);
  }

  async leaveQueue(userId: string): Promise<void> {
    const keys = ['queue:ANY'];
    for (const key of keys) {
      const members = await this.redis.zrange(key, 0, -1);
      for (const member of members) {
        try {
          const entry: QueueEntry = JSON.parse(member);
          if (entry.userId === userId) {
            await this.redis.zrem(key, member);
          }
        } catch {
          // skip malformed entries
        }
      }
    }
    this.logger.debug(`User ${userId} left queue`);
  }

  async findMatch(entry: QueueEntry): Promise<QueueEntry | null> {
    const blockedIds = await this.getBlockedIds(entry.userId);
    const members = await this.redis.zrange('queue:ANY', 0, 49);

    let bestRegion: { candidate: QueueEntry; score: number } | null = null;
    let bestAny: { candidate: QueueEntry; score: number } | null = null;

    for (const member of members) {
      try {
        const candidate: QueueEntry = JSON.parse(member);
        if (candidate.userId === entry.userId || blockedIds.includes(candidate.userId)) continue;

        // Premium gender filter: skip if either side has a wantGender preference that doesn't match
        if (entry.wantGender && candidate.gender !== entry.wantGender) continue;
        if (candidate.wantGender && entry.gender !== candidate.wantGender) continue;

        const interestScore = entry.interests.filter(i => candidate.interests.includes(i)).length;
        const purposeBonus = entry.purpose && candidate.purpose && entry.purpose === candidate.purpose ? 10 : 0;
        const score = interestScore + purposeBonus;

        if (entry.region && candidate.region === entry.region) {
          if (!bestRegion || score > bestRegion.score) bestRegion = { candidate, score };
        }
        if (!bestAny || score > bestAny.score) bestAny = { candidate, score };
      } catch {
        continue;
      }
    }

    return (bestRegion ?? bestAny)?.candidate ?? null;
  }

  async removeFromQueue(entry: QueueEntry): Promise<void> {
    const keys = ['queue:ANY'];
    for (const key of keys) {
      const members = await this.redis.zrange(key, 0, -1);
      for (const member of members) {
        try {
          const e: QueueEntry = JSON.parse(member);
          if (e.userId === entry.userId) {
            await this.redis.zrem(key, member);
          }
        } catch { /* skip */ }
      }
    }
  }

  /**
   * Atomically remove a queue entry by its exact serialized value.
   * Returns true if removed, false if it was already gone (claimed by another concurrent match).
   */
  async removeFromQueueAtomic(entry: QueueEntry): Promise<boolean> {
    const keys = ['queue:ANY'];
    for (const key of keys) {
      const members = await this.redis.zrange(key, 0, -1);
      for (const member of members) {
        try {
          const e: QueueEntry = JSON.parse(member);
          if (e.userId === entry.userId && e.socketId === entry.socketId) {
            const removed = await this.redis.zrem(key, member);
            return removed > 0;
          }
        } catch { /* skip */ }
      }
    }
    return false;
  }

  async createCall(userAId: string, userBId: string): Promise<string> {
    const roomId = uuidv4();
    await this.prisma.call.create({
      data: { participantA: userAId, participantB: userBId, roomId },
    });
    return roomId;
  }

  async endCall(roomId: string, reason: string): Promise<void> {
    const call = await this.prisma.call.findUnique({ where: { roomId } });
    if (!call || call.endedAt) return;

    const durationSecs = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
    await this.prisma.call.update({
      where: { roomId },
      data: { endedAt: new Date(), durationSecs, endReason: reason },
    });
  }

  private async getBlockedIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return blocks.map(b => (b.blockerId === userId ? b.blockedId : b.blockerId));
  }

  async flushQueue(): Promise<void> {
    const keys = ['queue:ANY'];
    await this.redis.del(...keys);
    this.logger.log(`Queue flushed (${keys.length} key(s) cleared on startup)`);
  }

  async getAllQueueKeys(): Promise<string[]> {
    return ['queue:ANY'];
  }

  async getQueueEntries(key: string): Promise<QueueEntry[]> {
    const members = await this.redis.zrange(key, 0, -1);
    const entries: QueueEntry[] = [];
    for (const m of members) {
      try { entries.push(JSON.parse(m)); } catch { /* skip */ }
    }
    return entries;
  }

  async getQueuePosition(userId: string): Promise<number> {
    const keys = ['queue:ANY'];
    for (const key of keys) {
      const members = await this.redis.zrange(key, 0, -1);
      const idx = members.findIndex(m => {
        try { return (JSON.parse(m) as QueueEntry).userId === userId; } catch { return false; }
      });
      if (idx !== -1) return idx + 1;
    }
    return 0;
  }
}
