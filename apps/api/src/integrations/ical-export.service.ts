import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ICalExportService {
  constructor(private readonly prisma: PrismaService) {}

  buildSubscribeToken(institutionId: string, entityId: string | null): string {
    const secret = process.env.JWT_SECRET?.trim() ?? 'unicore-ical-dev';
    const payload = `${institutionId}:${entityId ?? 'all'}`;
    return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  }

  verifyToken(institutionId: string, entityId: string | null, token: string): boolean {
    return token === this.buildSubscribeToken(institutionId, entityId);
  }

  async buildSubscribeUrl(
    institutionId: string,
    entityId: string | null,
  ): Promise<{ url: string; token: string }> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { slug: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');
    const token = this.buildSubscribeToken(institutionId, entityId);
    const apiBase = process.env.API_PUBLIC_URL?.trim() ?? 'http://localhost:4000';
    const qs = new URLSearchParams({ token });
    if (entityId) qs.set('entityId', entityId);
    return {
      token,
      url: `${apiBase.replace(/\/$/, '')}/public/ical/${inst.slug}/subscribe.ics?${qs.toString()}`,
    };
  }

  async buildFeed(institutionId: string, entityId: string | null): Promise<string> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { name: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');

    const meetings = await this.prisma.meeting.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
        scheduledAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
      select: { id: true, title: true, scheduledAt: true, durationMinutes: true, location: true },
    });

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UniCore//Calendar//EN',
      `X-WR-CALNAME:${inst.name} UniCore`,
    ];

    for (const m of meetings) {
      if (!m.scheduledAt) continue;
      const start = m.scheduledAt;
      const end = new Date(start.getTime() + (m.durationMinutes ?? 60) * 60_000);
      const fmt = (d: Date) =>
        d
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}Z$/, 'Z');
      lines.push(
        'BEGIN:VEVENT',
        `UID:meeting-${m.id}@unicore`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${(m.title ?? 'Meeting').replace(/\n/g, ' ')}`,
        ...(m.location ? [`LOCATION:${m.location.replace(/\n/g, ' ')}`] : []),
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  }
}
