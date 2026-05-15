import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL!.trim();
  return new Redis(url, { maxRetriesPerRequest: null });
}

/**
 * Registers BullMQ when `REDIS_URL` is set (see `AppModule`). Requires a reachable Redis server.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: createRedisConnection(),
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
