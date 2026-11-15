import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkshopFloor } from '../../application/use-cases/workshop-floor';
import { WorkOrder, WorkOrderStage } from '../../domain/work-order';

export class QueueQueryDto {
  @IsOptional()
  @IsEnum(WorkOrderStage)
  stage?: WorkOrderStage;
}

export class DiagnosisDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RepairFailureDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

const present = (workOrder: WorkOrder) => workOrder.toProps();

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly floor: WorkshopFloor) {}

  @Get()
  @ApiQuery({ name: 'stage', enum: WorkOrderStage, required: false })
  async queue(@Query() query: QueueQueryDto) {
    return (await this.floor.queue(query.stage)).map(present);
  }

  @Get(':orderId')
  async find(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return present(await this.floor.find(orderId));
  }

  @Post(':orderId/diagnosis/start')
  @HttpCode(HttpStatus.OK)
  async startDiagnosis(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return present(await this.floor.startDiagnosis(orderId));
  }

  @Post(':orderId/diagnosis/complete')
  @HttpCode(HttpStatus.OK)
  async completeDiagnosis(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: DiagnosisDto,
  ) {
    return present(await this.floor.completeDiagnosis(orderId, body.notes));
  }

  @Post(':orderId/repair/start')
  @HttpCode(HttpStatus.OK)
  async startRepair(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return present(await this.floor.startRepair(orderId));
  }

  @Post(':orderId/repair/complete')
  @HttpCode(HttpStatus.OK)
  async completeRepair(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return present(await this.floor.completeRepair(orderId));
  }

  @Post(':orderId/repair/fail')
  @HttpCode(HttpStatus.OK)
  async failRepair(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: RepairFailureDto,
  ) {
    return present(await this.floor.failRepair(orderId, body.reason));
  }
}
