import './instrumentation';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { config } from './config';
import { correlationMiddleware } from './infrastructure/observability/correlation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(correlationMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle('Oficina - Execution Service')
    .setDescription('Fila de execução, diagnóstico e reparo das ordens de serviço')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs/execution', app, SwaggerModule.createDocument(app, openApi));

  await app.listen(config.port);
}

void bootstrap();
