import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/module/database.module';
import { DepartmentModule } from './department/module/department.module';
import { ProgramModule } from './program/program.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true
        }),
        DatabaseModule,
        DepartmentModule,
        ProgramModule
    ]
})
export class AppModule {}
