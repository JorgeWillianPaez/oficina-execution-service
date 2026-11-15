import { Injectable, Logger } from '@nestjs/common';
import { VehicleSummary, WorkItem, WorkOrder } from '../../domain/work-order';
import { Events } from '../messaging-contracts';
import { MessagePublisher, WorkOrderRepository } from '../ports/ports';

export interface OpenWorkOrderCommand {
  orderId: string;
  customerName: string;
  vehicle: VehicleSummary;
  items: WorkItem[];
}

export interface OrderCommand {
  orderId: string;
  reason?: string;
}

@Injectable()
export class WorkOrderCommands {
  private readonly logger = new Logger(WorkOrderCommands.name);

  constructor(
    private readonly workOrders: WorkOrderRepository,
    private readonly publisher: MessagePublisher,
  ) {}

  async open(command: OpenWorkOrderCommand): Promise<void> {
    try {
      if (!(await this.workOrders.findByOrderId(command.orderId))) {
        await this.workOrders.save(WorkOrder.open(command));
      }
      await this.publisher.publish(Events.WORK_ORDER_OPENED, { orderId: command.orderId });
    } catch (error) {
      await this.reportFailure(Events.WORK_ORDER_OPEN_FAILED, command.orderId, error);
    }
  }

  async enqueueRepair({ orderId }: OrderCommand): Promise<void> {
    try {
      const workOrder = await this.workOrders.findByOrderId(orderId);
      if (!workOrder) throw new Error('Work order not found');
      workOrder.enqueueRepair();
      await this.workOrders.save(workOrder);
      await this.publisher.publish(Events.REPAIR_QUEUED, { orderId });
    } catch (error) {
      await this.reportFailure(Events.REPAIR_FAILED, orderId, error);
    }
  }

  async cancel({ orderId, reason }: OrderCommand): Promise<void> {
    const workOrder = await this.workOrders.findByOrderId(orderId);
    if (!workOrder || workOrder.isFinal) return;
    workOrder.cancel(reason);
    await this.workOrders.save(workOrder);
  }

  private async reportFailure(event: string, orderId: string, error: unknown): Promise<void> {
    this.logger.error({ msg: 'Work order command failed', event, orderId, err: error });
    await this.publisher.publish(event, {
      orderId,
      reason: `Execution failed: ${(error as Error).message}`,
    });
  }
}
