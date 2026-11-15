import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MessagePublisher, WorkOrderRepository } from '../../src/application/ports/ports';
import { WorkOrderCommands } from '../../src/application/use-cases/work-order-commands';
import { ApiModule } from '../../src/presentation/api.module';
import {
  InMemoryWorkOrderRepository,
  openCommand,
  ORDER_ID,
  RecordingMessagePublisher,
} from '../support/in-memory';

const ports = [
  { provide: WorkOrderRepository, useClass: InMemoryWorkOrderRepository },
  { provide: MessagePublisher, useClass: RecordingMessagePublisher },
];

@Global()
@Module({
  imports: [JwtModule.register({ global: true, secret: 'test-secret' })],
  providers: ports,
  exports: ports.map((port) => port.provide),
})
class InMemoryInfrastructureModule {}

describe('Execution Service API', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;

  const api = () => request(app.getHttpServer());
  const asAdmin = (test: request.Test) => test.set('Authorization', `Bearer ${adminToken}`);
  const action = (path: string) => asAdmin(api().post(`/work-orders/${ORDER_ID}/${path}`));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [InMemoryInfrastructureModule, ApiModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const jwt = app.get(JwtService);
    adminToken = await jwt.signAsync({ sub: 'admin', role: 'ADMIN' });
    customerToken = await jwt.signAsync({ sub: 'customer', role: 'CUSTOMER' });
    await app.get(WorkOrderCommands).open(openCommand());
  });

  afterAll(() => app.close());

  it('restricts the workshop floor to administrators', async () => {
    await api().get('/work-orders').expect(401);
    await api().get('/work-orders').set('Authorization', `Bearer ${customerToken}`).expect(403);
  });

  it('moves a work order through diagnosis and repair', async () => {
    const queue = await asAdmin(api().get('/work-orders')).expect(200);
    expect(queue.body).toHaveLength(1);
    await asAdmin(api().get('/work-orders?stage=INVALID')).expect(400);

    await action('repair/start').expect(422);
    await action('diagnosis/start').expect(200);
    const diagnosed = await action('diagnosis/complete').send({ notes: 'Troca necessária' }).expect(200);
    expect(diagnosed.body).toMatchObject({ stage: 'AWAITING_APPROVAL', diagnosisNotes: 'Troca necessária' });

    await app.get(WorkOrderCommands).enqueueRepair({ orderId: ORDER_ID });
    await action('repair/start').expect(200);
    await action('repair/fail').send({}).expect(400);
    const completed = await action('repair/complete').expect(200);
    expect(completed.body.stage).toBe('COMPLETED');

    await asAdmin(api().get(`/work-orders/${ORDER_ID}`)).expect(200);
    await asAdmin(api().get('/work-orders/00000000-0000-4000-8000-000000000000')).expect(404);
    await action('repair/fail').send({ reason: 'Tarde demais' }).expect(422);
  });
});
