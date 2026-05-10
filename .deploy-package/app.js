process.on('uncaughtException', (error) => {
  console.error('Uncaught exception during API startup:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection during API startup:', reason);
});

// ── CORS preflight handled at HTTP level — guaranteed to work on IIS/Plesk ──
const http = require('http');
const ALLOWED_ORIGIN = 'https://hr.duongminhvn.com';

const server = http.createServer((req, res) => {
  // Set CORS headers on EVERY response
  const origin = req.headers.origin || ALLOWED_ORIGIN;
  const allowed = [
    'https://hr.duongminhvn.com',
    'https://www.hr.duongminhvn.com',
    'http://localhost:3000',
    'http://localhost:4200',
  ];
  const corsOrigin = allowed.includes(origin) ? origin : ALLOWED_ORIGIN;

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Short-circuit OPTIONS — return 204 immediately, never hits NestJS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Forward everything else to NestJS
  nestHandler(req, res);
});

// NestJS lazy bootstrap
let nestHandler = (_req, res) => {
  res.writeHead(503);
  res.end('Starting...');
};

async function bootstrap() {
  // Import NestJS (compiled output)
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./dist/app.module');
  const { ValidationPipe } = require('@nestjs/common');
  const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  // Compression
  try {
    const compression = require('compression');
    app.use(compression());
  } catch (_) {}

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HR Duong Minh ERP API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'bearer')
    .addSecurityRequirements('bearer')
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, doc, { swaggerOptions: { persistAuthorization: true } });
  SwaggerModule.setup('api/v1/docs', app, doc, { swaggerOptions: { persistAuthorization: true } });

  // Get the internal Express instance and wire it as the handler
  await app.init();
  nestHandler = app.getHttpAdapter().getInstance();
  console.log('ERP API is ready (iisnode mode)');
}

// Start NestJS in background; server is already listening via iisnode named pipe
bootstrap().catch((err) => console.error('Bootstrap failed:', err));

// iisnode provides the port via process.env.PORT (named pipe)
server.listen(process.env.PORT);
