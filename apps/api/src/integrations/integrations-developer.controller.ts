import { Controller, ForbiddenException, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';

function assertDeveloperRead(user: AuthUser): void {
  if (user.permissions.includes('*')) return;
  if (
    user.permissions.includes('integrations.read') ||
    user.permissions.includes('integrations.write') ||
    user.permissions.includes('institutions.read') ||
    user.permissions.includes('institutions.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing integrations.read permission');
}

@ApiTags('integrations-developer')
@ApiBearerAuth('JWT')
@Controller('integrations/developer')
export class IntegrationsDeveloperController {
  @Get('docs')
  @ApiOperation({ summary: 'Developer documentation entry points' })
  docs(@CurrentUser() user: AuthUser) {
    assertDeveloperRead(user);
    const apiBase = process.env.API_PUBLIC_URL?.trim() ?? 'http://localhost:4000';
    const base = apiBase.replace(/\/$/, '');
    return {
      openApiUi: `${base}/api/docs`,
      openApiJson: `${base}/api/docs-json`,
      postmanCollection: `${base}/integrations/developer/postman-collection.json`,
      authentication: {
        jwt: 'Authorization: Bearer <access_token>',
        apiKey: 'Authorization: Bearer uc_live_<lookup>.<secret>',
        entityScope: 'X-Entity-ID header or ?entityId= query parameter',
      },
      webhooks: {
        signatureHeader: 'X-UniCore-Signature',
        timestampHeader: 'X-UniCore-Timestamp',
        eventHeader: 'X-UniCore-Event',
        algorithm: 'HMAC-SHA256 over "{timestamp}.{rawBody}"',
        verifyExample:
          'const expected = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")',
      },
      mobileSync: {
        attendanceSince: 'GET /sync/attendance?since=<ISO8601>&entityId=<optional>',
        attendanceBulk: 'POST /sync/attendance/bulk',
        fcmToken: 'POST /users/fcm-token',
        fieldSelection: 'Append ?fields=id,status,updatedAt to limit response payload',
      },
    };
  }

  @Get('postman-collection.json')
  @Header('Content-Type', 'application/json')
  @ApiOperation({ summary: 'Postman Collection v2.1 starter (import /api/docs-json for full API)' })
  postmanCollection(@CurrentUser() user: AuthUser) {
    assertDeveloperRead(user);
    const apiBase = process.env.API_PUBLIC_URL?.trim() ?? 'http://localhost:4000';
    const base = apiBase.replace(/\/$/, '');
    return {
      info: {
        name: 'UniCore API',
        description:
          'Starter collection. Import OpenAPI from /api/docs-json in Postman for full endpoint coverage.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{unicore_token}}', type: 'string' }],
      },
      variable: [
        { key: 'baseUrl', value: base },
        { key: 'unicore_token', value: '' },
        { key: 'entityId', value: '' },
        { key: 'affiliate_key', value: '' },
      ],
      item: [
        {
          name: 'Health',
          request: { method: 'GET', header: [], url: '{{baseUrl}}/health' },
        },
        {
          name: 'Integrations marketplace',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{unicore_token}}' }],
            url: '{{baseUrl}}/integrations/marketplace',
          },
        },
        {
          name: 'Sync attendance (delta)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{unicore_token}}' }],
            url: {
              raw: '{{baseUrl}}/sync/attendance?since=2020-01-01T00:00:00.000Z&entityId={{entityId}}&fields=id,studentId,status,updatedAt',
              host: ['{{baseUrl}}'],
              path: ['sync', 'attendance'],
              query: [
                { key: 'since', value: '2020-01-01T00:00:00.000Z' },
                { key: 'entityId', value: '{{entityId}}' },
                { key: 'fields', value: 'id,studentId,status,updatedAt' },
              ],
            },
          },
        },
        {
          name: 'Affiliate verify student',
          request: {
            method: 'POST',
            header: [
              { key: 'X-Affiliate-Key', value: '{{affiliate_key}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ institutionSlug: 'demo', studentNumber: 'STU-001' }, null, 2),
            },
            url: '{{baseUrl}}/public/affiliate/verify-student',
          },
        },
      ],
    };
  }
}
