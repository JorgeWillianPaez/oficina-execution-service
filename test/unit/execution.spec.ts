import { Events } from '../../src/application/messaging-contracts';
import { DomainError, NotFoundError } from '../../src/domain/errors';
import { WorkOrder, WorkOrderStage } from '../../src/domain/work-order';
import { buildExecution, Execution, openCommand, ORDER_ID } from '../support/in-memory';

describe('WorkOrder', () => {
  it('opens awaiting diagnosis with a timeline', () => {
    const workOrder = WorkOrder.open(openCommand());
    expect(workOrder.stage).toBe(WorkOrderStage.AWAITING_DIAGNOSIS);
    expect(workOrder.toProps().timeline).toHaveLength(1);
  });

  it('rejects incomplete data', () => {
    expect(() => WorkOrder.open({ ...openCommand(), orderId: '' })).toThrow(DomainError);
    expect(() => WorkOrder.open({ ...openCommand(), items: [] })).toThrow(DomainError);
    expect(() =>
      WorkOrder.open({ ...openCommand(), vehicle: { plate: '', brand: 'Fiat', model: 'Argo' } }),
    ).toThrow(DomainError);
  });

  it('follows diagnosis and repair stages in order', () => {
    const workOrder = WorkOrder.open(openCommand());
    expect(() => workOrder.startRepair()).toThrow(DomainError);

    workOrder.startDiagnosis();
    workOrder.completeDiagnosis('Pastilhas gastas');
    workOrder.enqueueRepair();
    workOrder.startRepair();
    workOrder.completeRepair();

    const props = workOrder.toProps();
    expect(props.diagnosisNotes).toBe('Pastilhas gastas');
    expect(props.timeline.map((change) => change.stage)).toEqual([
      WorkOrderStage.AWAITING_DIAGNOSIS,
      WorkOrderStage.IN_DIAGNOSIS,
      WorkOrderStage.AWAITING_APPROVAL,
      WorkOrderStage.REPAIR_QUEUED,
      WorkOrderStage.IN_REPAIR,
      WorkOrderStage.COMPLETED,
    ]);
    expect(workOrder.isFinal).toBe(true);
  });

  it('keeps final work orders untouched when cancelled', () => {
    const workOrder = WorkOrder.open(openCommand());
    workOrder.cancel('Orçamento recusado');
    workOrder.cancel('Novamente');
    expect(workOrder.toProps()).toMatchObject({
      stage: WorkOrderStage.CANCELLED,
      failureReason: 'Orçamento recusado',
    });
  });
});

describe('Execution use cases', () => {
  let execution: Execution;

  const workOrder = (orderId = ORDER_ID) => execution.workOrders.items.get(orderId)!;
  const diagnose = async (orderId = ORDER_ID) => {
    await execution.floor.startDiagnosis(orderId);
    await execution.floor.completeDiagnosis(orderId, 'Diagnóstico concluído');
  };

  beforeEach(async () => {
    execution = buildExecution();
    await execution.commands.open(openCommand());
  });

  describe('saga commands', () => {
    it('opens the work order once and confirms to the saga', async () => {
      const original = workOrder();
      await execution.commands.open(openCommand());
      expect(workOrder()).toBe(original);
      expect(execution.publisher.routingKeys()).toEqual([
        Events.WORK_ORDER_OPENED,
        Events.WORK_ORDER_OPENED,
      ]);
    });

    it('reports failures when the work order cannot be opened', async () => {
      execution.workOrders.failure = new Error('database unavailable');
      await execution.commands.open(openCommand('another-order'));
      expect(execution.publisher.messages.at(-1)).toEqual({
        routingKey: Events.WORK_ORDER_OPEN_FAILED,
        payload: { orderId: 'another-order', reason: 'Execution failed: database unavailable' },
      });
    });

    it('enqueues the repair after approval', async () => {
      await diagnose();
      await execution.commands.enqueueRepair({ orderId: ORDER_ID });
      expect(workOrder().stage).toBe(WorkOrderStage.REPAIR_QUEUED);
      expect(execution.publisher.routingKeys().at(-1)).toBe(Events.REPAIR_QUEUED);
    });

    it('reports repair failure when it cannot be enqueued', async () => {
      await execution.commands.enqueueRepair({ orderId: ORDER_ID });
      await execution.commands.enqueueRepair({ orderId: 'unknown-order' });
      expect(execution.publisher.routingKeys().slice(-2)).toEqual([
        Events.REPAIR_FAILED,
        Events.REPAIR_FAILED,
      ]);
    });

    it('cancels open work orders and ignores unknown or final ones', async () => {
      await execution.commands.cancel({ orderId: ORDER_ID, reason: 'Orçamento recusado' });
      await execution.commands.cancel({ orderId: ORDER_ID, reason: 'Novamente' });
      await execution.commands.cancel({ orderId: 'unknown-order' });
      expect(workOrder().failureReason).toBe('Orçamento recusado');
    });
  });

  describe('workshop floor', () => {
    it('publishes an event for each mechanic action', async () => {
      await diagnose();
      await execution.commands.enqueueRepair({ orderId: ORDER_ID });
      await execution.floor.startRepair(ORDER_ID);
      await execution.floor.completeRepair(ORDER_ID);

      expect(execution.publisher.routingKeys()).toEqual([
        Events.WORK_ORDER_OPENED,
        Events.DIAGNOSIS_STARTED,
        Events.DIAGNOSIS_COMPLETED,
        Events.REPAIR_QUEUED,
        Events.REPAIR_STARTED,
        Events.REPAIR_COMPLETED,
      ]);
    });

    it('reports a failed repair with its reason', async () => {
      await diagnose();
      await execution.commands.enqueueRepair({ orderId: ORDER_ID });
      await execution.floor.startRepair(ORDER_ID);
      await execution.floor.failRepair(ORDER_ID, 'Peça defeituosa');

      expect(workOrder().stage).toBe(WorkOrderStage.FAILED);
      expect(execution.publisher.messages.at(-1)).toEqual({
        routingKey: Events.REPAIR_FAILED,
        payload: { orderId: ORDER_ID, reason: 'Peça defeituosa' },
      });
    });

    it('rejects actions out of order and unknown work orders', async () => {
      await expect(execution.floor.startRepair(ORDER_ID)).rejects.toThrow(DomainError);
      await expect(execution.floor.find('unknown-order')).rejects.toThrow(NotFoundError);
    });

    it('lists the queue by stage priority and then oldest first', async () => {
      const older = WorkOrder.open(openCommand('older'), new Date('2026-01-01T08:00:00Z'));
      const newer = WorkOrder.open(openCommand('newer'), new Date('2026-01-01T09:00:00Z'));
      const inRepair = WorkOrder.open(openCommand('in-repair'), new Date('2026-01-01T10:00:00Z'));
      for (const item of [newer, older, inRepair]) await execution.workOrders.save(item);
      await diagnose('in-repair');
      await execution.commands.enqueueRepair({ orderId: 'in-repair' });
      await execution.floor.startRepair('in-repair');
      await execution.commands.cancel({ orderId: ORDER_ID });

      const queue = await execution.floor.queue();
      expect(queue.map((item) => item.orderId)).toEqual(['in-repair', 'older', 'newer']);
      await expect(execution.floor.queue(WorkOrderStage.IN_REPAIR)).resolves.toHaveLength(1);
    });
  });
});
