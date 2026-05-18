import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantModule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async assertEnabled(institutionId: string, module: TenantModule): Promise<void> {
    const row = await this.prisma.institutionModule.findFirst({
      where: { institutionId, module, deletedAt: null },
    });
    if (!row?.enabled) {
      throw new ForbiddenException(`Module ${module} is not enabled for this institution`);
    }
  }
}
