import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'hate_speech', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  reportedUserId: string;

  @IsString()
  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  callId?: string;
}
