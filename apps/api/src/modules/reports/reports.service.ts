import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    if (reporterId === dto.reportedUserId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const reported = await this.prisma.user.findUnique({ where: { id: dto.reportedUserId } });
    if (!reported) throw new BadRequestException('User not found');

    return this.prisma.report.create({
      data: {
        reporterId,
        reportedId: dto.reportedUserId,
        reason: dto.reason,
        description: dto.description,
        callId: dto.callId,
        status: 'open',
      },
    });
  }
}
