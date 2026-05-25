import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SessionGateway } from '../sessions/session.gateway';
import { SESSION_REALTIME } from '../sessions/session-realtime.token';
import { PlatformSessionMetricsService } from './platform-session-metrics.service';

@Injectable()
export class PlatformMonitoringPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PlatformMonitoringPublisher.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly metrics: PlatformSessionMetricsService,
    @Inject(SESSION_REALTIME) private readonly realtime: SessionGateway,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.publish();
    }, 30_000);
    void this.publish();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async publish(): Promise<void> {
    try {
      const snapshot = await this.metrics.snapshot();
      this.realtime.emitPlatformSessionMetrics(snapshot);
    } catch (err) {
      this.log.warn(
        `Platform session metrics publish failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
