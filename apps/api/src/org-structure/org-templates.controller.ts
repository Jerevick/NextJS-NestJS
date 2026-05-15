import { Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyOrgTemplateDto } from './dto/apply-org-template.dto';
import { OrgTemplatesService } from './org-templates.service';
import { assertInstitutionAccess, assertOrgWrite, assertEntityAccess } from './org-structure.utils';

@ApiTags('org-templates')
@Controller('org-templates')
export class OrgTemplatesController {
  constructor(
    private readonly templates: OrgTemplatesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('apply-to-entity')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  @ApiOperation({ summary: 'Apply entity-type org unit + position template' })
  async apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyOrgTemplateDto) {
    assertOrgWrite(user);
    assertInstitutionAccess(user, user.institutionId);
    assertEntityAccess(user, dto.entityId);
    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: dto.entityId, institutionId: user.institutionId, deletedAt: null },
      select: { id: true, type: true },
    });
    if (!entity) {
      throw new NotFoundException('Campus not found');
    }
    return this.templates.applyToEntity(user.institutionId, entity.id, entity.type, {
      force: dto.force,
    });
  }
}
