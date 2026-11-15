import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Commands } from '../../application/messaging-contracts';
import { WorkOrderCommands } from '../../application/use-cases/work-order-commands';
import { RabbitMqClient } from './rabbitmq.client';

const QUEUE = 'execution-service.commands';
const BINDINGS = ['execution.command.*'];

@Injectable()
export class WorkOrderCommandConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly client: RabbitMqClient,
    private readonly commands: WorkOrderCommands,
  ) {}

  onApplicationBootstrap(): void {
    void this.client.subscribe(QUEUE, BINDINGS, async (command, payload) => {
      if (command === Commands.OPEN_WORK_ORDER) await this.commands.open(payload);
      if (command === Commands.ENQUEUE_REPAIR) await this.commands.enqueueRepair(payload);
      if (command === Commands.CANCEL_WORK_ORDER) await this.commands.cancel(payload);
    });
  }
}
