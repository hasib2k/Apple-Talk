import {
  Body, Controller, Delete, Get, HttpCode,
  Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { InitAuthDto, RefreshTokenDto } from './dto/init-auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import type { GoogleProfile } from './strategies/google.strategy';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('init')
  async init(@Body() dto: InitAuthDto, @Req() req: Request) {
    try {
      const clientIp: string =
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        '';
      const deviceInfo = {
        userAgent: req.headers['user-agent'] ?? 'unknown',
        ip: clientIp,
      };
      return await this.authService.init(dto.deviceFingerprint, deviceInfo, clientIp);
    } catch (err) {
      console.error('AUTH INIT ERROR:', err);
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Delete('account')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: User) {
    await this.authService.deleteAccount(user.id);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  /**
   * Redirects browser to Google consent screen.
   * Optionally passes currentUserId via state param so anonymous data can be merged.
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Handled by passport — redirects to Google
  }

  /**
   * Google redirects here after consent.
   * Performs merge logic then redirects frontend with tokens as query params.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const state = req.query.state as string | undefined;
    const currentUserId = state ?? undefined;

    const clientIp: string =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip || '';
    const deviceInfo = { userAgent: req.headers['user-agent'] ?? 'unknown', ip: clientIp };

    const result = await this.authService.googleAuth(profile, deviceInfo);

    const rawFrontendUrl = process.env.FRONTEND_URL || this.config.get<string>('frontendUrl') || 'http://localhost:5173';
    const frontendUrl = rawFrontendUrl.split(',')[0].trim();
    const params = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      userId: result.user!.id,
    });
    return res.redirect(`${frontendUrl}/auth/google/success?${params.toString()}`);
  }

  /**
   * Called by the frontend when an already-authenticated anonymous user
   * wants to link their Google account without doing a full redirect flow.
   * (Used as a fallback / for the profile page link button.)
   */
  @Post('google/link')
  @HttpCode(200)
  async linkGoogle(@CurrentUser() user: User, @Req() req: Request) {
    // Returns the Google OAuth URL for the client to open
    const state = user.id;
    const clientId = process.env.GOOGLE_CLIENT_ID || this.config.get<string>('google.clientId');
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || this.config.get<string>('google.callbackUrl');
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl!)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('email profile')}` +
      `&state=${state}` +
      `&access_type=offline` +
      `&prompt=select_account`;
    return { url };
  }

  @Public()
  @Post('google/one-tap')
  @HttpCode(200)
  async googleOneTap(@Body() body: { credential: string }, @Req() req: Request) {
    const clientIp: string =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip || '';
    const deviceInfo = { userAgent: req.headers['user-agent'] ?? 'unknown', ip: clientIp };
    return this.authService.oneTapAuth(body.credential, deviceInfo);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: User) {
    return this.authService.logout(user.id);
  }
}
