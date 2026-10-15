import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { PrismaService } from '../../common/services/prisma.service';
import { LiveKitService } from './livekit.service';
import type { WebhookEvent } from 'livekit-server-sdk';

export type Role = 'host' | 'speaker' | 'audience';

interface CreateMeetingInput {
  title?: string;
  everyoneSpeaks?: boolean;
  audienceCanAsk?: boolean;
}

interface TokenInput {
  userId?: string | null;
  displayName?: string;
}

const CODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyz'; // no 'l' to avoid confusion

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LiveKitService,
    private readonly config: ConfigService,
  ) {}

  private randomGroup(len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return s;
  }

  private async generateUniqueCode(): Promise<string> {
    // Google-Meet-style: xxx-yyyy-zzz
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `${this.randomGroup(3)}-${this.randomGroup(4)}-${this.randomGroup(3)}`;
      const existing = await this.prisma.meeting.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new Error('Could not generate a unique meeting code');
  }

  async createMeeting(hostId: string, input: CreateMeetingInput) {
    const code = await this.generateUniqueCode();
    const meeting = await this.prisma.meeting.create({
      data: {
        code,
        title: input.title?.trim() || 'AppleTalk Meeting',
        hostId,
        everyoneSpeaks: input.everyoneSpeaks ?? false,
        audienceCanAsk: input.audienceCanAsk ?? true,
      },
    });
    await this.livekit.ensureRoom(code, meeting.maxParticipants);
    return { code: meeting.code, title: meeting.title, id: meeting.id };
  }

  async getByCode(code: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { code },
      include: { host: { select: { anonAlias: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    const liveCount = await this.prisma.meetingParticipant.count({
      where: { meetingId: meeting.id, leftAt: null },
    });
    return {
      code: meeting.code,
      title: meeting.title,
      status: meeting.status,
      hostAlias: meeting.host.anonAlias,
      chatEnabled: meeting.chatEnabled,
      everyoneSpeaks: meeting.everyoneSpeaks,
      audienceCanAsk: meeting.audienceCanAsk,
      participantCount: liveCount,
    };
  }

  async listMine(userId: string) {
    return this.prisma.meeting.findMany({
      where: { hostId: userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        code: true, title: true, status: true, startedAt: true, endedAt: true,
        _count: { select: { participants: true } },
      },
    });
  }

  async mintToken(code: string, input: TokenInput) {
    const meeting = await this.prisma.meeting.findUnique({ where: { code } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.status === 'ended') throw new GoneException('This meeting has ended');

    let identity: string;
    let name: string;
    let metaUserId: string | null = null;

    if (input.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new NotFoundException('User not found');
      if (user.isBanned) throw new ForbiddenException('Account banned');
      identity = `user_${user.id}`;
      name = user.anonAlias;
      metaUserId = user.id;
    } else {
      if (!this.config.get<boolean>('allowGuestJoin')) {
        throw new ForbiddenException('Sign in with Google to join this meeting');
      }
      identity = `guest_${this.randomGroup(10)}`;
      name = (input.displayName?.trim() || 'Guest').slice(0, 60);
    }

    const role: Role =
      metaUserId && metaUserId === meeting.hostId
        ? 'host'
        : meeting.everyoneSpeaks
          ? 'speaker'
          : 'audience';
    const canPublish = role !== 'audience';

    const metadata = JSON.stringify({ userId: metaUserId, role, displayName: name });

    await this.livekit.ensureRoom(code, meeting.maxParticipants);
    const token = await this.livekit.createToken({
      room: code,
      identity,
      name,
      metadata,
      canPublish,
    });

    return {
      token,
      url: this.livekit.url,
      identity,
      role,
      meeting: {
        code: meeting.code,
        title: meeting.title,
        chatEnabled: meeting.chatEnabled,
        audienceCanAsk: meeting.audienceCanAsk,
      },
    };
  }

  private async assertHost(code: string, userId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { code } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== userId) throw new ForbiddenException('Only the host can do this');
    return meeting;
  }

  async endMeeting(code: string, userId: string) {
    const meeting = await this.assertHost(code, userId);
    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'ended', endedAt: new Date() },
    });
    await this.prisma.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, leftAt: null },
      data: { leftAt: new Date() },
    });
    await this.livekit.deleteRoom(code);
    return { success: true };
  }

  async setChat(code: string, userId: string, enabled: boolean) {
    const meeting = await this.assertHost(code, userId);
    await this.prisma.meeting.update({ where: { id: meeting.id }, data: { chatEnabled: enabled } });
    return { chatEnabled: enabled };
  }

  async promote(code: string, userId: string, targetIdentity: string) {
    const meeting = await this.assertHost(code, userId);
    await this.livekit.setCanPublish(code, targetIdentity, true);
    await this.prisma.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, identity: targetIdentity, leftAt: null },
      data: { role: 'speaker' },
    });
    return { success: true };
  }

  async demote(code: string, userId: string, targetIdentity: string) {
    const meeting = await this.assertHost(code, userId);
    await this.livekit.setCanPublish(code, targetIdentity, false);
    await this.prisma.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, identity: targetIdentity, leftAt: null },
      data: { role: 'audience' },
    });
    return { success: true };
  }

  async muteParticipant(code: string, userId: string, targetIdentity: string) {
    await this.assertHost(code, userId);
    await this.livekit.muteParticipant(code, targetIdentity);
    return { success: true };
  }

  async kick(code: string, userId: string, targetIdentity: string) {
    const meeting = await this.assertHost(code, userId);
    await this.livekit.removeParticipant(code, targetIdentity);
    await this.prisma.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, identity: targetIdentity, leftAt: null },
      data: { leftAt: new Date() },
    });
    return { success: true };
  }

  // ─── Webhook (LiveKit → us): authoritative join/leave tracking ──────────────

  async handleWebhook(event: WebhookEvent) {
    const room = event.room?.name;
    if (!room) return;
    const meeting = await this.prisma.meeting.findUnique({ where: { code: room } });
    if (!meeting) return;

    if (event.event === 'participant_joined' && event.participant) {
      const p = event.participant;
      let role = 'audience';
      let userId: string | null = null;
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        role = meta.role ?? 'audience';
        userId = meta.userId ?? null;
      } catch { /* no metadata */ }

      // Avoid duplicate open rows for the same identity
      const existing = await this.prisma.meetingParticipant.findFirst({
        where: { meetingId: meeting.id, identity: p.identity, leftAt: null },
      });
      if (!existing) {
        await this.prisma.meetingParticipant.create({
          data: {
            meetingId: meeting.id,
            userId,
            identity: p.identity,
            displayName: p.name || 'Guest',
            role,
          },
        });
      }
    } else if (event.event === 'participant_left' && event.participant) {
      await this.prisma.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, identity: event.participant.identity, leftAt: null },
        data: { leftAt: new Date() },
      });
    } else if (event.event === 'room_finished') {
      await this.prisma.meeting.updateMany({
        where: { id: meeting.id, status: 'live' },
        data: { status: 'ended', endedAt: new Date() },
      });
      await this.prisma.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, leftAt: null },
        data: { leftAt: new Date() },
      });
    }
  }
}
