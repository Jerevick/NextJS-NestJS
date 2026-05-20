import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ICalExportService } from './ical-export.service';

@ApiTags('integrations-public')
@Controller('public/ical')
export class ICalPublicController {
  constructor(
    private readonly ical: ICalExportService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get(':institutionSlug/subscribe.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @ApiOperation({ summary: 'Read-only iCal feed (token required)' })
  async subscribe(
    @Param('institutionSlug') institutionSlug: string,
    @Query('token') token: string,
    @Query('entityId') entityId?: string,
  ): Promise<string> {
    const inst = await this.prisma.institution.findFirst({
      where: { slug: institutionSlug, deletedAt: null },
      select: { id: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');
    const scoped = entityId?.trim() || null;
    if (!token?.trim() || !this.ical.verifyToken(inst.id, scoped, token.trim())) {
      throw new NotFoundException('Invalid calendar token');
    }
    return this.ical.buildFeed(inst.id, scoped);
  }
}
