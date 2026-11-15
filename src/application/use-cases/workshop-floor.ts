import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../domain/errors';
import { QUEUE_STAGES_BY_PRIORITY, WorkOrder, WorkOrderStage } from '../../domain/work-order';
import { Events } from '../messaging-contracts';
import { MessagePublisher, WorkOrderRepository } from '../ports/ports';

@Injectable()
export class WorkshopFloor {
  constructor(
    private readonly workOrders: WorkOrderRepository,
    private readonly publisher: MessagePublisher,
  ) {}

  async queue(stage?: WorkOrderStage): Promise<WorkOrder[]> {
    const stages = stage ? [stage] : QUEUE_STAGES_BY_PRIORITY;
    const workOrders = await this.workOrders.listByStages(stages);
    const priority = (workOrder: WorkOrder) => stages.indexOf(workOrder.stage);
    return workOrders.sort(
      (a, b) => priority(a) - priority(b) || a.createdAt.localeCompare(b.createdAt),
    );
  }

  async find(orderId: string): Promise<WorkOrder> {
    const workOrder = await this.workOrders.findByOrderId(orderId);
    if (!workOrder) throw new NotFoundError('Work order not found');
    return workOrder;
  }

  startDiagnosis(orderId: string): Promise<WorkOrder> {
    return this.advance(orderId, Events.DIAGNOSIS_STARTED, (workOrder) =>
      workOrder.startDiagnosis(),
    );
  }

  completeDiagnosis(orderId: string, notes?: string): Promise<WorkOrder> {
    return this.advance(orderId, Events.DIAGNOSIS_COMPLETED, (workOrder) =>
      workOrder.completeDiagnosis(notes),
    );
  }

  startRepair(orderId: string): Promise<WorkOrder> {
    return this.advance(orderId, Events.REPAIR_STARTED, (workOrder) => workOrder.startRepair());
  }

  completeRepair(orderId: string): Promise<WorkOrder> {
    return this.advance(orderId, Events.REPAIR_COMPLETED, (workOrder) =>
      workOrder.completeRepair(),
    );
  }

  failRepair(orderId: string, reason: string): Promise<WorkOrder> {
    return this.advance(orderId, Events.REPAIR_FAILED, (workOrder) => workOrder.failRepair(reason));
  }

  private async advance(
    orderId: string,
    event: string,
    change: (workOrder: WorkOrder) => void,
  ): Promise<WorkOrder> {
    const workOrder = await this.find(orderId);
    change(workOrder);
    await this.workOrders.save(workOrder);
    await this.publisher.publish(event, {
      orderId,
      ...(workOrder.failureReason && { reason: workOrder.failureReason }),
    });
    return workOrder;
  }
}
