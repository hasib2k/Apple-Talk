import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, PrismaService],
})
export class CallsModule {}
