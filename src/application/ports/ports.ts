import { WorkOrder, WorkOrderStage } from '../../domain/work-order';

export type Role = 'ADMIN' | 'CUSTOMER';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export abstract class WorkOrderRepository {
  abstract save(workOrder: WorkOrder): Promise<void>;
  abstract findByOrderId(orderId: string): Promise<WorkOrder | null>;
  abstract listByStages(stages: WorkOrderStage[]): Promise<WorkOrder[]>;
}

export abstract class MessagePublisher {
  abstract publish(routingKey: string, payload: object): Promise<void>;
}
