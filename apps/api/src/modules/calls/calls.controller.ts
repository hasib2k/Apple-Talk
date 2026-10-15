import { Controller, Get, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get('history')
  getHistory(@CurrentUser() user: User) {
    return this.callsService.getHistory(user.id);
  }
}
