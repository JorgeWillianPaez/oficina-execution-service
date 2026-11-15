import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  paginateScan,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { WorkOrderRepository } from '../../application/ports/ports';
import { config } from '../../config';
import { WorkOrder, WorkOrderProps, WorkOrderStage } from '../../domain/work-order';

const LOCAL_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' };

@Injectable()
export class DynamoWorkOrderRepository implements WorkOrderRepository, OnModuleInit {
  private readonly table = config.dynamo.table;
  private readonly client = new DynamoDBClient({
    region: config.dynamo.region,
    endpoint: config.dynamo.endpoint,
    credentials: config.dynamo.endpoint ? LOCAL_CREDENTIALS : undefined,
  });
  private readonly documents = DynamoDBDocumentClient.from(this.client);

  async onModuleInit(): Promise<void> {
    if (config.dynamo.endpoint) await this.ensureLocalTable();
  }

  async save(workOrder: WorkOrder): Promise<void> {
    await this.documents.send(new PutCommand({ TableName: this.table, Item: workOrder.toProps() }));
  }

  async findByOrderId(orderId: string): Promise<WorkOrder | null> {
    const { Item } = await this.documents.send(
      new GetCommand({ TableName: this.table, Key: { orderId } }),
    );
    return Item ? WorkOrder.restore(Item as WorkOrderProps) : null;
  }

  async listByStages(stages: WorkOrderStage[]): Promise<WorkOrder[]> {
    const placeholders = stages.map((_, index) => `:stage${index}`);
    const pages = paginateScan(
      { client: this.documents },
      {
        TableName: this.table,
        FilterExpression: `#stage IN (${placeholders.join(', ')})`,
        ExpressionAttributeNames: { '#stage': 'stage' },
        ExpressionAttributeValues: Object.fromEntries(
          stages.map((stage, index) => [placeholders[index], stage]),
        ),
      },
    );
    const workOrders: WorkOrder[] = [];
    for await (const page of pages) {
      workOrders.push(...(page.Items ?? []).map((item) => WorkOrder.restore(item as WorkOrderProps)));
    }
    return workOrders;
  }

  async ping(): Promise<void> {
    await this.client.send(new DescribeTableCommand({ TableName: this.table }));
  }

  private async ensureLocalTable(): Promise<void> {
    try {
      await this.ping();
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) throw error;
      await this.client.send(
        new CreateTableCommand({
          TableName: this.table,
          BillingMode: 'PAY_PER_REQUEST',
          KeySchema: [{ AttributeName: 'orderId', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'orderId', AttributeType: 'S' }],
        }),
      );
    }
  }
}
