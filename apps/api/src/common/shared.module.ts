import { Global, Module } from '@nestjs/common';
import { SocketEmitterService } from './services/socket-emitter.service';

@Global()
@Module({
  providers: [SocketEmitterService],
  exports: [SocketEmitterService],
})
export class SharedModule {}
