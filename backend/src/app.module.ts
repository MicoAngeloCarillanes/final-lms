import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/module/database.module';
import { DepartmentModule } from './department/module/department.module';
import { ProgramModule } from './program/program.module';
import { UserModule } from './user/user.module';
import { SchoolYearModule } from './school-years/school-year.module';
import { CourseOfferingModule } from './course-offerings/course-offering.module';
import { AttendanceModule } from './attendance/attendance.module';

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
    ],
})
export class AppModule {}
