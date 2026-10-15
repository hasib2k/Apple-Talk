import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './modules/redis/redis.module';
import { FriendsModule } from './modules/friends/friends.module';
import { CallsModule } from './modules/calls/calls.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PostsModule } from './modules/posts/posts.module';
import { PushModule } from './modules/push/push.module';
import { SpikeModule } from './modules/spike/spike.module';
import { SharedModule } from './common/shared.module';
import { AppGateway } from './gateways/app.gateway';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaService } from './common/services/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // .env lives at the monorepo root; the API runs with CWD = apps/api,
      // so point explicitly at the root file (falling back to a local one).
      envFilePath: [
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redis.url') ?? 'redis://localhost:6379',
      }),
    }),

    SharedModule,
    RedisModule,
    AuthModule,
    UsersModule,
    MatchmakingModule,
    HealthModule,
    FriendsModule,
    CallsModule,
    ReportsModule,
    AdminModule,
    PaymentsModule,
    NotificationsModule,
    PostsModule,
    PushModule,
    SpikeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    AppGateway,
    PrismaService,
  ],
})
export class AppModule {}
