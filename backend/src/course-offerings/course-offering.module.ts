import { Module } from '@nestjs/common';
import { CourseOfferingController } from './course-offering.controller';
import { CourseOfferingService } from './course-offering.service';
import { CourseOfferingRepository } from './repository/course-offering.repository';

@Module({
    controllers: [CourseOfferingController],
    providers: [CourseOfferingService, CourseOfferingRepository],
    exports: [CourseOfferingService],
})
export class CourseOfferingModule {}
