import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.anonAlias && { anonAlias: dto.anonAlias }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.interests && { interests: dto.interests }),
      },
    });
  }

  async getInterests() {
    return this.prisma.interest.findMany({ orderBy: { label: 'asc' } });
  }

  async getCallHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where: {
          OR: [{ participantA: userId }, { participantB: userId }],
          endedAt: { not: null },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          userA: { select: { id: true, anonAlias: true } },
          userB: { select: { id: true, anonAlias: true } },
        },
      }),
      this.prisma.call.count({
        where: {
          OR: [{ participantA: userId }, { participantB: userId }],
          endedAt: { not: null },
        },
      }),
    ]);

    return { data: calls, total, page, limit };
  }
}
