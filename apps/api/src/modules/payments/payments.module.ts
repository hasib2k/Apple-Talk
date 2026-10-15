import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [PaymentsController],
  providers: [PrismaService],
})
export class PaymentsModule {}
