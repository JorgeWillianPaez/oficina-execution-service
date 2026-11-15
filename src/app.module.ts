import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { WorkOrderCommandConsumer } from './infrastructure/messaging/work-order-command.consumer';
import { loggerOptions } from './infrastructure/observability/logger';
import { ApiModule } from './presentation/api.module';

@Module({
  imports: [LoggerModule.forRoot(loggerOptions), InfrastructureModule, ApiModule],
  providers: [WorkOrderCommandConsumer],
})
export class AppModule {}
