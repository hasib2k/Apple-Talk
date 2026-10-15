import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, PrismaService],
})
export class AdminModule {}
