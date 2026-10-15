import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Body() dto: CreateReportDto, @Req() req: Request & { user: { id: string } }) {
    return this.reportsService.create(req.user.id, dto);
  }
}
