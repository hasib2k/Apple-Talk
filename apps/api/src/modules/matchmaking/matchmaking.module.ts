import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  providers: [MatchmakingService, PrismaService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
