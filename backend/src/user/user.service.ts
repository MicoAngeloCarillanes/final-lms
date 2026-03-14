import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { DatabaseService } from 'src/database/service/database.service';
import { ChangePasswordRequestDto, ResetPasswordRequestDto } from './dto/user.dto';

interface UserRow extends RowDataPacket {
    user_id: string;
    username: string;
    password_hash: string;
    role: string;
    is_active: number;
}

@Injectable()
export class UserService {
    private readonly pool: Pool;

    /** Default password used when a sub-admin resets without specifying one. */
    private readonly DEFAULT_PASSWORD: string;

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly configService: ConfigService,
    ) {
        this.pool = databaseService.getPool();
        this.DEFAULT_PASSWORD = this.configService.get<string>('DEFAULT_PASSWORD') ?? 'Welcome@123';
    }

    // ─── Password Reset (sub-admin initiated) ─────────────────────────────────
    async resetPassword(dto: ResetPasswordRequestDto): Promise<string> {
        const { username, newPassword } = dto;
        const user = await this.findByUsername(username);
        const hash = await bcrypt.hash(newPassword ?? this.DEFAULT_PASSWORD, 10);
        await this.updatePasswordHash(user.user_id, hash);
        return `Password for "${username}" has been reset successfully.`;
    }

    // ─── Change Password (self-service) ───────────────────────────────────────
    async changePassword(dto: ChangePasswordRequestDto): Promise<string> {
        const { username, currentPassword, newPassword } = dto;
        const user = await this.findByUsername(username);
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) throw new UnauthorizedException('Current password is incorrect.');
        const hash = await bcrypt.hash(newPassword, 10);
        await this.updatePasswordHash(user.user_id, hash);
        return 'Password changed successfully.';
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    private async findByUsername(username: string): Promise<UserRow> {
        const [rows] = await this.pool.query<UserRow[]>(
            `SELECT user_id, username, password_hash, role, is_active
             FROM users WHERE username = ? AND is_active = 1 LIMIT 1`,
            [username]
        );
        if (!rows.length) throw new NotFoundException(`User "${username}" not found or inactive.`);
        return rows[0];
    }

    private async updatePasswordHash(userId: string, hash: string): Promise<void> {
        await this.pool.execute<ResultSetHeader>(
            `UPDATE users SET password_hash = ? WHERE user_id = ?`,
            [hash, userId]
        );
    }
}