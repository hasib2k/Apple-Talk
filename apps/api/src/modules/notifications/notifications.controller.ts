import { Controller, Get, Patch, Req } from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';

interface AuthRequest extends Request {
  user: { id: string };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Req() req: AuthRequest) {
    return this.notificationsService.getForUser(req.user.id);
  }

  @Patch('read')
  markAllRead(@Req() req: AuthRequest) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
