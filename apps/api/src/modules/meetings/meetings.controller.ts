import {
  Body, Controller, Get, Param, Patch, Post, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { User } from '@prisma/client';
import { MeetingsService } from './meetings.service';
import { LiveKitService } from './livekit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class CreateMeetingDto {
  @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @IsOptional() @IsBoolean()
  everyoneSpeaks?: boolean;

  @IsOptional() @IsBoolean()
  audienceCanAsk?: boolean;
}

class JoinTokenDto {
  @IsOptional() @IsString() @MaxLength(60)
  displayName?: string;
}

class IdentityDto {
  @IsString()
  identity: string;
}

class ChatToggleDto {
  @IsBoolean()
  enabled: boolean;
}

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly livekit: LiveKitService,
    private readonly jwt: JwtService,
  ) {}

  // ─── Create / list (authenticated) ──────────────────────────────

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateMeetingDto) {
    return this.meetings.createMeeting(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.meetings.listMine(user.id);
  }

  // ─── LiveKit webhook (public, signed) ───────────────────────────

  @Public()
  @Post('webhook')
  async webhook(@Req() req: Request) {
    // Raw parser (registered in main.ts) leaves req.body as a Buffer.
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const authHeader = req.headers.authorization ?? '';
    const event = await this.livekit.receiveWebhook(raw, authHeader);
    await this.meetings.handleWebhook(event);
    return { received: true };
  }

  // ─── Lobby info (public) ────────────────────────────────────────

  @Public()
  @Get(':code')
  getByCode(@Param('code') code: string) {
    return this.meetings.getByCode(code);
  }

  // ─── Join token (public, optional auth) ─────────────────────────

  @Public()
  @Post(':code/token')
  async token(@Param('code') code: string, @Body() dto: JoinTokenDto, @Req() req: Request) {
    const userId = this.extractUserId(req);
    return this.meetings.mintToken(code, { userId, displayName: dto.displayName });
  }

  // ─── Host controls (authenticated, host-only inside service) ─────

  @Post(':code/end')
  end(@CurrentUser() user: User, @Param('code') code: string) {
    return this.meetings.endMeeting(code, user.id);
  }

  @Patch(':code/chat')
  chat(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: ChatToggleDto) {
    return this.meetings.setChat(code, user.id, dto.enabled);
  }

  @Post(':code/promote')
  promote(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: IdentityDto) {
    return this.meetings.promote(code, user.id, dto.identity);
  }

  @Post(':code/demote')
  demote(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: IdentityDto) {
    return this.meetings.demote(code, user.id, dto.identity);
  }

  @Post(':code/mute')
  mute(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: IdentityDto) {
    return this.meetings.muteParticipant(code, user.id, dto.identity);
  }

  @Post(':code/kick')
  kick(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: IdentityDto) {
    return this.meetings.kick(code, user.id, dto.identity);
  }

  /** Decode the optional Bearer token; returns userId or null (guest). */
  private extractUserId(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(auth.slice(7));
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
