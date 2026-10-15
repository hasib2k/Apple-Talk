import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AddFriendDto {
  @IsString()
  friendId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string;
}
