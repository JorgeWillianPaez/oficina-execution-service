import { MessagePublisher, WorkOrderRepository } from '../../src/application/ports/ports';
import { WorkOrderCommands } from '../../src/application/use-cases/work-order-commands';
import { WorkshopFloor } from '../../src/application/use-cases/workshop-floor';
import { WorkOrder, WorkOrderStage } from '../../src/domain/work-order';

export class InMemoryWorkOrderRepository implements WorkOrderRepository {
  readonly items = new Map<string, WorkOrder>();
  failure?: Error;

  async save(workOrder: WorkOrder) {
    if (this.failure) throw this.failure;
    this.items.set(workOrder.orderId, workOrder);
  }

  async findByOrderId(orderId: string) {
    return this.items.get(orderId) ?? null;
  }

  async listByStages(stages: WorkOrderStage[]) {
    return [...this.items.values()].filter((workOrder) => stages.includes(workOrder.stage));
  }
}

export class RecordingMessagePublisher implements MessagePublisher {
  readonly messages: { routingKey: string; payload: any }[] = [];

  async publish(routingKey: string, payload: object) {
    this.messages.push({ routingKey, payload });
  }

  routingKeys(): string[] {
    return this.messages.map((message) => message.routingKey);
  }
}

export const ORDER_ID = '3f1c2b5e-8a4d-4c1e-9b7a-2d6e5f4a3b21';

export const openCommand = (orderId = ORDER_ID) => ({
  orderId,
  customerName: 'Maria Silva',
  vehicle: { plate: 'ABC1D23', brand: 'Fiat', model: 'Argo' },
  items: [
    { type: 'SERVICE' as const, name: 'Troca de óleo', quantity: 1 },
    { type: 'PART' as const, name: 'Filtro de óleo', quantity: 2 },
  ],
});

export const buildExecution = () => {
  const workOrders = new InMemoryWorkOrderRepository();
  const publisher = new RecordingMessagePublisher();
  return {
    workOrders,
    publisher,
    commands: new WorkOrderCommands(workOrders, publisher),
    floor: new WorkshopFloor(workOrders, publisher),
  };
};

export type Execution = ReturnType<typeof buildExecution>;
