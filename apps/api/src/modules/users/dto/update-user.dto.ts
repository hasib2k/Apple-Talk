import { IsArray, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 30)
  anonAlias?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  region?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female'])
  gender?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];
}
