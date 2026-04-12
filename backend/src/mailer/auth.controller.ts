import { Body, Controller, Post } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly mailerService: MailerService) {}

    @Post('send-invite')
    async invite(@Body() body: { email: string; fullName: string; username: string; token: string }) {
        return await this.mailerService.sendInvitation(
            body.email,
            body.fullName,
            body.username, // Added username passing here
            body.token
        );
    }
}
