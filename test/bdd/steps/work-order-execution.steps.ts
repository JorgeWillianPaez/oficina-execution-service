import assert from 'node:assert/strict';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import { buildExecution, Execution, openCommand, ORDER_ID } from '../../support/in-memory';

interface Scenario {
  execution: Execution;
}

Before(function (this: Scenario) {
  this.execution = buildExecution();
});

Given('uma ordem de trabalho aberta pela saga', async function (this: Scenario) {
  await this.execution.commands.open(openCommand());
});

When('o mecânico realiza o diagnóstico', async function (this: Scenario) {
  await this.execution.floor.startDiagnosis(ORDER_ID);
  await this.execution.floor.completeDiagnosis(ORDER_ID, 'Diagnóstico concluído');
});

When('a saga libera o reparo', async function (this: Scenario) {
  await this.execution.commands.enqueueRepair({ orderId: ORDER_ID });
});

When('o mecânico inicia o reparo', async function (this: Scenario) {
  await this.execution.floor.startRepair(ORDER_ID);
});

When('o mecânico conclui o reparo', async function (this: Scenario) {
  await this.execution.floor.completeRepair(ORDER_ID);
});

When('o mecânico registra falha no reparo por {string}', async function (this: Scenario, reason: string) {
  await this.execution.floor.failRepair(ORDER_ID, reason);
});

Then('a ordem de trabalho fica no estágio {string}', function (this: Scenario, stage: string) {
  assert.equal(this.execution.workOrders.items.get(ORDER_ID)?.stage, stage);
});

Then('a saga é informada com {string}', function (this: Scenario, routingKey: string) {
  assert.equal(this.execution.publisher.routingKeys().at(-1), routingKey);
});
