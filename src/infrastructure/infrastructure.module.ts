import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessagePublisher, WorkOrderRepository } from '../application/ports/ports';
import { config } from '../config';
import { HealthController } from './health.controller';
import { RabbitMqMessagePublisher } from './messaging/rabbitmq-message-publisher';
import { RabbitMqClient } from './messaging/rabbitmq.client';
import { DynamoWorkOrderRepository } from './persistence/dynamo-work-order.repository';

const ports = [
  { provide: WorkOrderRepository, useExisting: DynamoWorkOrderRepository },
  { provide: MessagePublisher, useClass: RabbitMqMessagePublisher },
];

@Global()
@Module({
  imports: [JwtModule.register({ global: true, secret: config.jwtSecret })],
  controllers: [HealthController],
  providers: [DynamoWorkOrderRepository, RabbitMqClient, ...ports],
  exports: [RabbitMqClient, ...ports.map((port) => port.provide)],
})
export class InfrastructureModule {}
