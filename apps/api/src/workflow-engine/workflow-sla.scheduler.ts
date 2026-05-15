import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkflowEngineService } from './workflow-engine.service';

@Injectable()
export class WorkflowSlaScheduler {
  private readonly log = new Logger(WorkflowSlaScheduler.name);

  constructor(private readonly engine: WorkflowEngineService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleSlaBreaches(): Promise<void> {
    const count = await this.engine.checkSlaBreaches();
    if (count > 0) {
      this.log.warn(`Auto-escalated ${count} workflow instance(s) due to SLA breach`);
    }
  }
}
