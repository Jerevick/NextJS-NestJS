import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateRoomDto } from './dto/create-room.dto';
import type { ListRoomsQueryDto } from './dto/list-rooms-query.dto';
import type { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsRepository } from './rooms.repository';

@Injectable()
export class RoomsService {
  constructor(
    private readonly repo: RoomsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateRoomDto) {
    const building = dto.building.trim();
    const name = dto.name.trim();
    const dup = await this.repo.findByBuildingName(actor.institutionId, building, name);
    if (dup) {
      throw new ConflictException('A room with this building and name already exists');
    }
    const row = await this.repo.create({
      institutionId: actor.institutionId,
      building,
      name,
      capacity: dto.capacity ?? 30,
      type: (dto.type ?? 'CLASSROOM').trim() || 'CLASSROOM',
      facilities: (dto.facilities ?? {}) as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'room.create',
      entity: 'Room',
      entityId: row.id,
      newValues: {
        building: row.building,
        name: row.name,
        capacity: row.capacity,
        type: row.type,
        facilities: row.facilities,
      },
    });
    return row;
  }

  async list(actor: AuthUser, query: ListRoomsQueryDto) {
    const limit = query.limit ?? 20;
    const where = this.repo.buildListWhere({
      institutionId: actor.institutionId,
      building: query.building?.trim(),
      type: query.type?.trim(),
      search: query.search?.trim(),
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);
    return { data: rows, nextCursor, total };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Room not found');
    }
    return row;
  }

  async update(actor: AuthUser, id: string, dto: UpdateRoomDto) {
    const existing = await this.repo.findById(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Room not found');
    }
    const nextBuilding = dto.building !== undefined ? dto.building.trim() : existing.building;
    const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (nextBuilding !== existing.building || nextName !== existing.name) {
      const dup = await this.repo.findByBuildingName(actor.institutionId, nextBuilding, nextName);
      if (dup && dup.id !== existing.id) {
        throw new ConflictException('A room with this building and name already exists');
      }
    }

    const data: Prisma.RoomUpdateInput = {};
    if (dto.building !== undefined) {
      data.building = nextBuilding;
    }
    if (dto.name !== undefined) {
      data.name = nextName;
    }
    if (dto.capacity !== undefined) {
      data.capacity = dto.capacity;
    }
    if (dto.type !== undefined) {
      data.type = dto.type.trim() || 'CLASSROOM';
    }
    if (dto.facilities !== undefined) {
      data.facilities = dto.facilities as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.update(existing.id, data);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'room.update',
      entity: 'Room',
      entityId: updated.id,
      oldValues: {
        building: existing.building,
        name: existing.name,
        capacity: existing.capacity,
        type: existing.type,
        facilities: existing.facilities,
      },
      newValues: {
        building: updated.building,
        name: updated.name,
        capacity: updated.capacity,
        type: updated.type,
        facilities: updated.facilities,
      },
    });
    return updated;
  }

  async remove(actor: AuthUser, id: string) {
    const existing = await this.repo.findById(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Room not found');
    }
    const n = await this.repo.softDelete(actor.institutionId, id, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Room not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'room.delete',
      entity: 'Room',
      entityId: id,
      oldValues: {
        building: existing.building,
        name: existing.name,
        capacity: existing.capacity,
        type: existing.type,
      },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }
}
