import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/services/prisma.service';

class CreatePaymentRequestDto {
  @IsString()
  @IsIn(['bkash', 'nagad'])
  method: string;

  @IsString()
  @MaxLength(64)
  transactionId: string;

  @IsString()
  @IsIn(['7day', '15day', '30day', 'weekly', 'monthly'])
  plan: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('request')
  async createRequest(@CurrentUser() user: User, @Body() dto: CreatePaymentRequestDto) {
    const amount =
      dto.plan === '7day' ? 25 :
      dto.plan === '15day' ? 50 :
      dto.plan === '30day' ? 100 :
      dto.plan === 'weekly' ? 50 : 100;
    const request = await this.prisma.paymentRequest.create({
      data: {
        userId: user.id,
        method: dto.method,
        transactionId: dto.transactionId,
        amount,
        plan: dto.plan,
        status: 'pending',
      },
    });
    return { success: true, id: request.id };
  }
}
