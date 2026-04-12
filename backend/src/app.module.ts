import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttendanceModule } from './attendance/attendance.module';
import { CourseOfferingModule } from './course-offerings/course-offering.module';
import { DatabaseModule } from './database/module/database.module';
import { DepartmentModule } from './department/module/department.module';
import { AuthModule } from './mailer/auth.module';
import { ProgramModule } from './program/program.module';
import { SchoolYearModule } from './school-years/school-year.module';
import { UserModule } from './user/user.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        DepartmentModule,
        ProgramModule,
        UserModule,
        SchoolYearModule,
        CourseOfferingModule,
        AttendanceModule,
        AuthModule
    ]
})
export class AppModule {}
