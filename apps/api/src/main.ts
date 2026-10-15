import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { raw } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.use(helmet());

  // LiveKit webhooks arrive as `application/webhook+json` which the default JSON
  // parser ignores. Capture the raw Buffer so the signature can be verified.
  app.use('/api/v1/meetings/webhook', raw({ type: () => true }));

  // Trust reverse-proxy headers so req.ip is the real client IP
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map(o => o.trim())
    : true;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`AppleTalk API running on http://localhost:${port}/api/v1`);
}

bootstrap();
