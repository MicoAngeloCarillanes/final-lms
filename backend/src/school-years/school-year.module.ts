import { Module } from '@nestjs/common';
import { SchoolYearController } from './school-year.controller';
import { SchoolYearService } from './school-year.service';
import { SchoolYearRepository } from './repository/school-year.repository';

@Module({
    controllers: [SchoolYearController],
    providers: [SchoolYearService, SchoolYearRepository],
    exports: [SchoolYearService],
})
export class SchoolYearModule {}
