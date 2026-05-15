import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('rooms.read', 'rooms.write')
  list(@CurrentUser() user: AuthUser, @Query() query: ListRoomsQueryDto) {
    return this.rooms.list(user, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('rooms.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(user, dto);
  }

  @Get(':id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('rooms.read', 'rooms.write')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rooms.getById(user, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('rooms.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.rooms.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('rooms.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rooms.remove(user, id);
  }
}
