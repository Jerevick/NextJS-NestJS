import type {
  IntegrationCategory,
  IntegrationTestResult,
  UniCoreIntegration,
} from '../integration.types';

export abstract class BaseIntegration implements UniCoreIntegration {
  abstract readonly code: string;
  abstract readonly name: string;
  abstract readonly category: IntegrationCategory;
  readonly description?: string;

  async configure(
    _institutionId: string,
    _entityId: string | null,
    _settings: Record<string, unknown>,
  ): Promise<void> {
    // Default: validation only; persistence handled by IntegrationsService.
  }

  async disable(_institutionId: string, _entityId: string | null): Promise<void> {
    // No-op unless provider needs teardown.
  }

  async test(_institutionId: string, _entityId: string | null): Promise<IntegrationTestResult> {
    return this.ok('Integration registered');
  }

  protected missingEnv(vars: string[]): IntegrationTestResult {
    return {
      success: false,
      message: `Missing environment: ${vars.join(', ')}`,
    };
  }

  protected ok(message = 'Connection successful'): IntegrationTestResult {
    return { success: true, message };
  }
}
