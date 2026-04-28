import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const defaultOrigins = [
    'https://hr.duongminhvn.com',
    'https://www.hr.duongminhvn.com',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:4200',
  ];
  const envOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV === 'development') return callback(null, true);
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HR Duong Minh ERP API')
    .setDescription('Swagger documentation for the HR Duong Minh ERP backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  SwaggerModule.setup('api/v1/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const server = app.getHttpAdapter().getInstance();
  server.get('/', (_req: Request, res: Response) => {
    res.redirect('/docs');
  });

  const port = process.env.PORT || 3000;

  console.log('RAW_PORT =', process.env.PORT);
  console.log('LISTEN_TARGET =', port);

  await app.listen(port);

  console.log('ERP API is running');
  console.log(`Swagger UI: http://localhost:${port}/docs`);
  console.log(`Swagger JSON: http://localhost:${port}/docs-json`);
}

bootstrap();
