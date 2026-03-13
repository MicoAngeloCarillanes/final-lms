import { Global, Module } from '@nestjs/common';
import { DatabaseService } from '../service/database.service';

// prettier-ignore
/**
 * Global database module that provides the shared DatabaseService.
 *
 * Marked with @Global() so the DatabaseService can be injected across feature modules
 * without importing DatabaseModule repeatedly.
 */
@Global()
@Module({
    providers: [DatabaseService],
    exports: [DatabaseService]
})
export class DatabaseModule {

}
