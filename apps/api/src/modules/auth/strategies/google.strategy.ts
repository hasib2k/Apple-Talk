import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || config.get<string>('google.clientId') || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || config.get<string>('google.clientSecret') || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || config.get<string>('google.callbackUrl') || '',
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): void {
    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName ?? '',
    };
    done(null, googleProfile);
  }
}
