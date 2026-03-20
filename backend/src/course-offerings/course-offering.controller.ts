import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CourseOfferingService } from './course-offering.service';
import {
    AutoAssignResultDto,
    CourseOfferingDto,
    CreateCourseOfferingDto,
} from './dto/course-offering.dto';

@Controller('course-offerings')
export class CourseOfferingController {
    constructor(private readonly service: CourseOfferingService) {}

    /** Create a new course offering. */
    @Post()
    create(@Body() dto: CreateCourseOfferingDto): Promise<CourseOfferingDto> {
        return this.service.create(dto);
    }

    /**
     * List course offerings, optionally filtered by SY and/or term.
     * GET /course-offerings?syId=xxx&term=Finals
     */
    @Get()
    getAll(
        @Query('syId') syId?: string,
        @Query('term') term?: string,
    ): Promise<CourseOfferingDto[]> {
        return this.service.getAll(syId, term);
    }

    /** Get a single offering by ID. */
    @Get(':offeringId')
    getById(@Param('offeringId') offeringId: string): Promise<CourseOfferingDto> {
        return this.service.getById(offeringId);
    }

    /**
     * Auto-assign all eligible students to this offering's course.
     * POST /course-offerings/:offeringId/auto-assign
     */
    @Post(':offeringId/auto-assign')
    @HttpCode(HttpStatus.OK)
    autoAssign(@Param('offeringId') offeringId: string): Promise<AutoAssignResultDto> {
        return this.service.autoAssign(offeringId);
    }
}
