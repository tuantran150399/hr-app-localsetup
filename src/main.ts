import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── CORS ────────────────────────────────────────────────────────────────
  // Temporary: allow localhost + any IP during development.
  // Tighten to https://hr.duongminhvn.com once DNS/SSL is live.
  const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Also allow any http://<ip>:<port> during development
      if (process.env.NODE_ENV === 'development') return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ─── Global prefix ───────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Global validation pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform payloads to DTO class instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`\n🚀  HR Duong Minh ERP API is running`);
  console.log(`   Local:   http://localhost:${port}/api/v1`);
  console.log(`   Env:     ${process.env.NODE_ENV ?? 'development'}\n`);
}

bootstrap();
