import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../presentation/auth/auth.decorators';
import { DynamoWorkOrderRepository } from './persistence/dynamo-work-order.repository';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly repository: DynamoWorkOrderRepository) {}

  @Public()
  @Get()
  async check() {
    await this.repository.ping();
    return { status: 'ok' };
  }
}
