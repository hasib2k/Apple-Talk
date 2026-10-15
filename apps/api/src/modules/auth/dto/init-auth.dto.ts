import { IsString, Length } from 'class-validator';

export class InitAuthDto {
  @IsString()
  @Length(8, 128)
  deviceFingerprint!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
