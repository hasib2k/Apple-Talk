import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { Public } from '../../common/decorators/public.decorator';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

class UpdateReportDto {
  @IsString()
  @IsIn(['open', 'reviewed', 'closed'])
  status: string;
}

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

class RejectPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
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

  @Get('stats/daily')
  getDailyStats(@Req() req: Request, @Query('days') days = 30) {
    checkAdmin(req);
    return this.adminService.getDailyStats(+days);
  }

  @Post('reset/users')
  resetAllUsers(@Req() req: Request) {
    checkAdmin(req);
    return this.adminService.resetAllUsers();
  }

  // ─── Reports ──────────────────────────────────────────────

  @Get('reports')
  getReports(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    checkAdmin(req);
    return this.adminService.getReports(status, +page, +limit);
  }

  @Patch('reports/:id')
  updateReport(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    checkAdmin(req);
    return this.adminService.updateReportStatus(id, dto.status);
  }

  // ─── Users ────────────────────────────────────────────────

  @Get('users')
  getUsers(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('gender') gender?: string,
    @Query('region') region?: string,
    @Query('isLinked') isLinked?: string,
  ) {
    checkAdmin(req);
    const isLinkedBool = isLinked === 'true' ? true : isLinked === 'false' ? false : undefined;
    return this.adminService.getUsers(+page, +limit, search, gender, region, isLinkedBool);
  }

  @Get('users/regions')
  getUserRegions(@Req() req: Request) {
    checkAdmin(req);
    return this.adminService.getUserRegions();
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

  @Post('users/:id/cancel-subscription')
  cancelSubscription(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.cancelSubscription(id);
  }

  @Post('users/:id/set-premium')
  setPremium(@Req() req: Request, @Param('id') id: string, @Body() body: { isPremium: boolean; plan?: string }) {
    checkAdmin(req);
    return this.adminService.setPremium(id, body.isPremium, body.plan);
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

  // ─── Posts ────────────────────────────────────────────────

  @Get('posts')
  getPosts(@Req() req: Request, @Query('page') page = 1, @Query('limit') limit = 20) {
    checkAdmin(req);
    return this.adminService.getPosts(+page, +limit);
  }

  @Delete('posts/:id')
  deletePost(@Req() req: Request, @Param('id') id: string) {
    checkAdmin(req);
    return this.adminService.deletePost(id);
  }

  // ─── Calls ────────────────────────────────────────────────

  @Get('calls')
  getCalls(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    checkAdmin(req);
    return this.adminService.getCalls(+page, +limit);
  }

  // ─── Payments ─────────────────────────────────────────────

  @Get('payments')
  getPayments(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('plan') plan?: string,
  ) {
    checkAdmin(req);
    return this.adminService.getPayments(status, +page, +limit, plan);
  }

  @Post('payments/:id/approve')
  approvePayment(@Req() req: Request, @Param('id') id: string, @Body() body: { plan?: string }) {
    checkAdmin(req);
    return this.adminService.approvePayment(id, body?.plan);
  }

  @Post('payments/:id/reject')
  rejectPayment(@Req() req: Request, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    checkAdmin(req);
    return this.adminService.rejectPayment(id, dto.note);
  }
}
