import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { Public } from '../../common/decorators/public.decorator';

/**
 * TEMPORARY spike controller — proves the LiveKit audio pipe works end-to-end.
 * Mints a token for a hardcoded test room. Removed in Phase 1.
 */
@Controller('spike')
export class SpikeController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Post('token')
  async token(@Body() body: { room?: string; identity?: string }) {
    const room = body.room || 'spike-room';
    const identity = body.identity || `user-${Math.random().toString(36).slice(2, 8)}`;

    const apiKey = this.config.get<string>('livekit.apiKey')!;
    const apiSecret = this.config.get<string>('livekit.apiSecret')!;
    const url = this.config.get<string>('livekit.url')!;

    const at = new AccessToken(apiKey, apiSecret, { identity, name: identity });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();

    return { token, url, room, identity };
  }
}
