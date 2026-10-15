import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  WebhookEvent,
  TrackType,
} from 'livekit-server-sdk';

export interface TokenOptions {
  room: string;
  identity: string;
  name: string;
  metadata?: string;
  canPublish: boolean;
}

/**
 * Wraps the LiveKit server SDK: mint join tokens, manage rooms/participants
 * server-side, and validate incoming webhooks.
 */
@Injectable()
export class LiveKitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly wsUrl: string;
  private readonly httpUrl: string;
  private readonly roomService: RoomServiceClient;
  private readonly webhookReceiver: WebhookReceiver;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('livekit.apiKey')!;
    this.apiSecret = config.get<string>('livekit.apiSecret')!;
    this.wsUrl = config.get<string>('livekit.url')!;
    // RoomServiceClient needs the HTTP(S) url, not the ws(s) one.
    this.httpUrl = this.wsUrl.replace(/^ws/, 'http');
    this.roomService = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret);
    this.webhookReceiver = new WebhookReceiver(this.apiKey, this.apiSecret);
  }

  get url() {
    return this.wsUrl;
  }

  async createToken(opts: TokenOptions): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: opts.identity,
      name: opts.name,
      metadata: opts.metadata,
    });
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: opts.canPublish,
      canSubscribe: true,
      canPublishData: true, // chat + raise-hand over data channel
    });
    return at.toJwt();
  }

  async ensureRoom(name: string, maxParticipants: number): Promise<void> {
    try {
      await this.roomService.createRoom({
        name,
        maxParticipants,
        emptyTimeout: 60 * 10, // keep room 10 min after last person leaves
      });
    } catch {
      // room already exists — fine
    }
  }

  async deleteRoom(name: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(name);
    } catch {
      /* room may already be gone */
    }
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    try {
      await this.roomService.removeParticipant(room, identity);
    } catch {
      /* participant may have left */
    }
  }

  /** Grant or revoke publishing rights (promote audience → speaker / demote). */
  async setCanPublish(room: string, identity: string, canPublish: boolean, metadata?: string): Promise<void> {
    await this.roomService.updateParticipant(room, identity, metadata, {
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });
  }

  /** Force-mute all of a participant's audio tracks (host moderation). */
  async muteParticipant(room: string, identity: string): Promise<void> {
    try {
      const p = await this.roomService.getParticipant(room, identity);
      for (const track of p.tracks) {
        if (track.type === TrackType.AUDIO) {
          await this.roomService.mutePublishedTrack(room, identity, track.sid, true);
        }
      }
    } catch {
      /* participant may have left */
    }
  }

  async receiveWebhook(body: string, authHeader: string): Promise<WebhookEvent> {
    return this.webhookReceiver.receive(body, authHeader);
  }
}
