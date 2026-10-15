import { Body, Controller, Delete, Post, Req } from '@nestjs/common';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('subscribe')
  async subscribe(
    @Req() req: any,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.pushService.saveSubscription(req.user.id, body);
    return { ok: true };
  }

  @Delete('subscribe')
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.pushService.deleteSubscription(body.endpoint);
    return { ok: true };
  }
}
