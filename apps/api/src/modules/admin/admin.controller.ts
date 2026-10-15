import {
  Body, Controller, Delete, Get, Param, Post, Query, Req, UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { Public } from '../../common/decorators/public.decorator';
import { IsOptional, IsString, MaxLength } from 'class-validator';

class BanUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  banIp?: boolean;
}

class AddIpBanDto {
  @IsString()
  ip: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

function checkAdmin(req: Request) {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || !key || key !== expected) {
    throw new UnauthorizedException('Invalid password');
  }
}

@Public()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats(@Req() req: Request) {
    checkAdmin(req);
    return this.adminService.getStats();
  }

  @Post('reset/users')
  resetAllUsers(@Req() req: Request) {
    checkAdmin(req);
    return this.adminService.resetAllUsers();
  }

  // ─── Users ────────────────────────────────────────────────

  @Get('users')
  getUsers(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('isLinked') isLinked?: string,
  ) {
    checkAdmin(req);
    const isLinkedBool = isLinked === 'true' ? true : isLinked === 'false' ? false : undefined;
    return this.adminService.getUsers(+page, +limit, search, isLinkedBool);
  }

  @Get('users/:id/ip')
  getUserIpInfo(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.getUserIpInfo(id);
  }

  @Post('users/:id/ban')
  banUser(@Req() req: Request, @Param('id') id: string, @Body() dto: BanUserDto) {
    checkAdmin(req);
    return this.adminService.banUser(id, dto.reason, dto.banIp !== false);
  }

  @Post('users/:id/unban')
  unbanUser(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.unbanUser(id);
  }

  // ─── Meetings ─────────────────────────────────────────────

  @Get('meetings')
  getMeetings(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    checkAdmin(req);
    return this.adminService.getMeetings(+page, +limit, status);
  }

  @Get('meetings/:id/participants')
  getMeetingParticipants(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.getMeetingParticipants(id);
  }

  // ─── IP Bans ──────────────────────────────────────────────

  @Get('ip-bans')
  getIpBans(@Req() req: Request, @Query('page') page = 1, @Query('limit') limit = 20) {
    checkAdmin(req);
    return this.adminService.getIpBans(+page, +limit);
  }

  @Post('ip-bans')
  addIpBan(@Req() req: Request, @Body() dto: AddIpBanDto) {
    checkAdmin(req);
    return this.adminService.addIpBan(dto.ip, dto.reason);
  }

  @Delete('ip-bans/:id')
  removeIpBan(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.removeIpBan(id);
  }
}
