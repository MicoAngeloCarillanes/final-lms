import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool, Pool } from 'mysql2/promise';

/**
 * Database service responsible for managing the shared MySQL connection pool.
 *
 * Provides centralized database access for repositories and handles cleanup
 * when the application/module is destroyed.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private readonly pool: Pool;

    constructor(private readonly configService: ConfigService) {
        this.pool = createPool({
            host: this.configService.get<string>('DB_HOST') ?? 'localhost',
            port: Number(this.configService.get<string>('DB_PORT') ?? '3306'),
            database: this.configService.get<string>('DB_NAME') ?? 'new_lms',
            user: this.configService.get<string>('DB_USER') ?? 'root',
            password: this.configService.get<string>('DB_PASSWORD') ?? '',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    getPool(): Pool {
        return this.pool;
    }

    async onModuleDestroy(): Promise<void> {
        await this.pool.end();
    }
}
