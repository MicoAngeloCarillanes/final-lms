import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MailerService } from './mailer.service';

@Module({
  controllers: [AuthController], // MUST be here
  providers: [MailerService]
})
export class AuthModule {}
