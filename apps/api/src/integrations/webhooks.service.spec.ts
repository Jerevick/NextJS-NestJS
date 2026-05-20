import { WebhooksService } from './webhooks.service';
import type { WebhookDeliveryService } from './webhook-delivery.service';
import type { IntegrationsRepository } from './integrations.repository';
import type { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';

describe('WebhooksService', () => {
  const actor: AuthUser = {
    userId: 'u1',
    email: 'a@test.local',
    role: 'ADMIN',
    institutionId: 'inst1',
    entityId: '',
    entityScope: 'ALL',
    permissions: ['integrations.write'],
  };

  it('rejects non-HTTPS webhook URLs', async () => {
    const service = new WebhooksService(
      {} as IntegrationsRepository,
      { buildEnvelope: jest.fn(), enqueueDelivery: jest.fn() } as unknown as WebhookDeliveryService,
      { append: jest.fn() } as unknown as AuditService,
    );
    await expect(
      service.create(actor, { event: 'student.enrolled', url: 'http://insecure.example/hook' }),
    ).rejects.toThrow('HTTPS');
  });
});
