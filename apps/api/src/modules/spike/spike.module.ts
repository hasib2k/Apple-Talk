import { Module } from '@nestjs/common';
import { SpikeController } from './spike.controller';

/** TEMPORARY — removed in Phase 1. */
@Module({ controllers: [SpikeController] })
export class SpikeModule {}
