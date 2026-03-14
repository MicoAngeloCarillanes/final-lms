// ─── src/user/dto/user.dto.ts ─────────────────────────────────────────────────
// (All DTOs in one file for simplicity)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Request to reset a user's password to the school default.
 * Called by a sub-admin (department admin) on behalf of a user who forgot theirs.
 */
export class ResetPasswordRequestDto {
    @ApiProperty({ description: 'Username of the account to reset', example: 'jdoe' })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiPropertyOptional({ description: 'New password (defaults to school default if omitted)', example: 'Welcome@123' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    @MaxLength(100)
    newPassword?: string;
}

/**
 * Request to change a user's own password.
 * Requires the current password for verification.
 */
export class ChangePasswordRequestDto {
    @ApiProperty({ description: 'Username', example: 'jdoe' })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiProperty({ description: 'Current password for verification', example: 'OldPass123' })
    @IsString()
    @IsNotEmpty()
    currentPassword!: string;

    @ApiProperty({ description: 'New password', example: 'NewPass456' })
    @IsString()
    @MinLength(6)
    @MaxLength(100)
    newPassword!: string;
}
