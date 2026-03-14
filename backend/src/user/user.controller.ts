import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { ChangePasswordRequestDto, ResetPasswordRequestDto } from './dto/user.dto';

@ApiTags('User')
@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    /**
     * Reset a user's password to the default (or a supplied password).
     * Called by a sub-admin / department admin on behalf of a user.
     *
     * POST /api/user/reset-password
     * Body: { username: string, newPassword?: string }
     */
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset user password to default (sub-admin action)' })
    resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<string> {
        return this.userService.resetPassword(dto);
    }

    /**
     * Let a user change their own password.
     * Requires their current password for verification.
     *
     * POST /api/user/change-password
     * Body: { username: string, currentPassword: string, newPassword: string }
     */
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change own password (self-service)' })
    changePassword(@Body() dto: ChangePasswordRequestDto): Promise<string> {
        return this.userService.changePassword(dto);
    }
}
