import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { LiveKitService } from './livekit.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [ConfigModule, AuthModule], // AuthModule exports JwtModule (for optional-auth token endpoint)
  controllers: [MeetingsController],
  providers: [MeetingsService, LiveKitService, PrismaService],
})
export class MeetingsModule {}
