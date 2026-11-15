import { DomainError } from './errors';

export enum WorkOrderStage {
  AWAITING_DIAGNOSIS = 'AWAITING_DIAGNOSIS',
  IN_DIAGNOSIS = 'IN_DIAGNOSIS',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  REPAIR_QUEUED = 'REPAIR_QUEUED',
  IN_REPAIR = 'IN_REPAIR',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export const QUEUE_STAGES_BY_PRIORITY = [
  WorkOrderStage.IN_REPAIR,
  WorkOrderStage.REPAIR_QUEUED,
  WorkOrderStage.IN_DIAGNOSIS,
  WorkOrderStage.AWAITING_DIAGNOSIS,
];

const FINAL_STAGES = [WorkOrderStage.COMPLETED, WorkOrderStage.FAILED, WorkOrderStage.CANCELLED];

export interface WorkItem {
  type: 'SERVICE' | 'PART';
  name: string;
  quantity: number;
}

export interface VehicleSummary {
  plate: string;
  brand: string;
  model: string;
}

export interface StageChange {
  stage: WorkOrderStage;
  at: string;
}

export interface WorkOrderProps {
  orderId: string;
  customerName: string;
  vehicle: VehicleSummary;
  items: WorkItem[];
  stage: WorkOrderStage;
  diagnosisNotes: string | null;
  failureReason: string | null;
  timeline: StageChange[];
  createdAt: string;
}

export class WorkOrder {
  private constructor(private readonly props: WorkOrderProps) {}

  static open(
    input: Pick<WorkOrderProps, 'orderId' | 'customerName' | 'vehicle' | 'items'>,
    now = new Date(),
  ): WorkOrder {
    if (!input.orderId) throw new DomainError('Work order requires a service order');
    if (!input.vehicle?.plate) throw new DomainError('Work order requires a vehicle');
    if (!input.items?.length) throw new DomainError('Work order requires at least one item');
    return new WorkOrder({
      ...input,
      stage: WorkOrderStage.AWAITING_DIAGNOSIS,
      diagnosisNotes: null,
      failureReason: null,
      timeline: [{ stage: WorkOrderStage.AWAITING_DIAGNOSIS, at: now.toISOString() }],
      createdAt: now.toISOString(),
    });
  }

  static restore(props: WorkOrderProps): WorkOrder {
    return new WorkOrder(props);
  }

  get orderId() {
    return this.props.orderId;
  }

  get stage() {
    return this.props.stage;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get failureReason() {
    return this.props.failureReason;
  }

  get isFinal(): boolean {
    return FINAL_STAGES.includes(this.props.stage);
  }

  toProps(): WorkOrderProps {
    return structuredClone(this.props);
  }

  startDiagnosis(now = new Date()): void {
    this.move([WorkOrderStage.AWAITING_DIAGNOSIS], WorkOrderStage.IN_DIAGNOSIS, now);
  }

  completeDiagnosis(notes: string | undefined, now = new Date()): void {
    this.move([WorkOrderStage.IN_DIAGNOSIS], WorkOrderStage.AWAITING_APPROVAL, now);
    this.props.diagnosisNotes = notes ?? null;
  }

  enqueueRepair(now = new Date()): void {
    this.move([WorkOrderStage.AWAITING_APPROVAL], WorkOrderStage.REPAIR_QUEUED, now);
  }

  startRepair(now = new Date()): void {
    this.move([WorkOrderStage.REPAIR_QUEUED], WorkOrderStage.IN_REPAIR, now);
  }

  completeRepair(now = new Date()): void {
    this.move([WorkOrderStage.IN_REPAIR], WorkOrderStage.COMPLETED, now);
  }

  failRepair(reason: string, now = new Date()): void {
    this.move([WorkOrderStage.REPAIR_QUEUED, WorkOrderStage.IN_REPAIR], WorkOrderStage.FAILED, now);
    this.props.failureReason = reason;
  }

  cancel(reason: string | undefined, now = new Date()): void {
    if (this.isFinal) return;
    this.props.stage = WorkOrderStage.CANCELLED;
    this.props.failureReason = reason ?? null;
    this.props.timeline.push({ stage: WorkOrderStage.CANCELLED, at: now.toISOString() });
  }

  private move(from: WorkOrderStage[], to: WorkOrderStage, now: Date): void {
    if (!from.includes(this.props.stage)) {
      throw new DomainError(`Work order in stage ${this.props.stage} cannot move to ${to}`);
    }
    this.props.stage = to;
    this.props.timeline.push({ stage: to, at: now.toISOString() });
  }
}
