import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthCoreModule } from './auth-core.module';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthController } from './auth.controller';
import { OauthGoogleController } from './oauth-google.controller';
import { SamlAuthController } from './saml-auth.controller';
import { SamlAuthService } from './saml-auth.service';

@Module({
  imports: [AuthCoreModule, forwardRef(() => NotificationsModule.register())],
  controllers: [AuthController, SamlAuthController, OauthGoogleController],
  providers: [AuthRegistrationService, SamlAuthService],
  exports: [AuthCoreModule, AuthRegistrationService],
})
export class AuthModule {}
