import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { UsersMobileService } from './users-mobile.service';

@ApiTags('users-mobile')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersMobileController {
  constructor(private readonly mobile: UsersMobileService) {}

  @Post('fcm-token')
  @ApiOperation({ summary: 'Register FCM push token for mobile app' })
  registerFcm(@CurrentUser() user: AuthUser, @Body() dto: RegisterFcmTokenDto) {
    return this.mobile.registerFcmToken(user, dto.token);
  }
}
