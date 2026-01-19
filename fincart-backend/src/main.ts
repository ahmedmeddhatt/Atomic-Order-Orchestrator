import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import compression from 'compression';
import { AppModule } from './app.module';
import { RawBodyRequest } from './orders/guards/shopify-webhook.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Enable Gzip/Brotli compression for all responses
  // This reduces payload size by 70-80% for JSON responses
  app.use(compression({
    level: 6, // Balance between compression ratio and CPU usage (0-9, default 6)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  // Enable raw body access for HMAC verification
  app.use(
    json({
      verify: (req: RawBodyRequest, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;

  await app.listen(port);
  logger.log(`Application running on port ${port}`);
  logger.log(`✅ Gzip compression enabled`);
  logger.log(`✅ Pagination implemented (skip/take + cursor-based)`);
  logger.log(`✅ Query optimization: selective column loading`);
  logger.log(`WebSocket available at ws://localhost:${port}/sync`);
}

bootstrap();
