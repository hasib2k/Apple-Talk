import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(userId: string) {
    const calls = await this.prisma.call.findMany({
      where: {
        OR: [{ participantA: userId }, { participantB: userId }],
        endedAt: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: 150,
      include: {
        userA: { select: { id: true, anonAlias: true, region: true, gender: true, isPremium: true, isLinked: true } },
        userB: { select: { id: true, anonAlias: true, region: true, gender: true, isPremium: true, isLinked: true } },
      },
    });

    const seen = new Set<string>();
    const result: {
      id: string;
      partnerId: string;
      partnerAlias: string;
      partnerRegion: string | null;
      partnerGender: string | null;
      partnerIsPremium: boolean;
      partnerIsLinked: boolean;
      startedAt: Date;
      durationSecs: number;
    }[] = [];

    for (const call of calls) {
      const isA = call.participantA === userId;
      const partner = isA ? call.userB : call.userA;
      if (!seen.has(partner.id)) {
        seen.add(partner.id);
        result.push({
          id: call.id,
          partnerId: partner.id,
          partnerAlias: partner.anonAlias,
          partnerRegion: partner.region ?? null,
          partnerGender: partner.gender ?? null,
          partnerIsPremium: partner.isPremium,
          partnerIsLinked: partner.isLinked,
          startedAt: call.startedAt,
          durationSecs: call.durationSecs ?? 0,
        });
      }
      if (result.length >= 15) break;
    }

    return result;
  }
}
