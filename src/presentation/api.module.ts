import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { WorkOrderCommands } from '../application/use-cases/work-order-commands';
import { WorkshopFloor } from '../application/use-cases/workshop-floor';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { WorkOrdersController } from './controllers/work-orders.controller';
import { DomainExceptionFilter } from './domain-exception.filter';

@Module({
  controllers: [WorkOrdersController],
  providers: [
    WorkOrderCommands,
    WorkshopFloor,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
  exports: [WorkOrderCommands],
})
export class ApiModule {}
