import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
    AttendanceSummaryDto,
    BulkRecordDto,
    CreateSessionDto,
    RecordDto,
    SessionDto,
} from './dto/attendance.dto';

@Controller('attendance')
export class AttendanceController {
    constructor(private readonly service: AttendanceService) {}

    /** Create a new attendance session for a course. */
    @Post('sessions')
    createSession(@Body() dto: CreateSessionDto): Promise<SessionDto> {
        return this.service.createSession(dto);
    }

    /**
     * List sessions for a course, optionally filtered by term.
     * GET /attendance/sessions?courseId=xxx&term=Prelim
     */
    @Get('sessions')
    getSessions(
        @Query('courseId') courseId: string,
        @Query('term') term?: string,
    ): Promise<SessionDto[]> {
        return this.service.getSessionsByCourse(courseId, term);
    }

    /** Get a single session. */
    @Get('sessions/:sessionId')
    getSession(@Param('sessionId') sessionId: string): Promise<SessionDto> {
        return this.service.getSessionById(sessionId);
    }

    /** Save (bulk upsert) attendance records for a session. */
    @Post('sessions/:sessionId/records')
    @HttpCode(HttpStatus.OK)
    saveRecords(
        @Param('sessionId') sessionId: string,
        @Body() dto: BulkRecordDto,
    ): Promise<{ saved: number }> {
        return this.service.saveRecords(sessionId, dto);
    }

    /** Get all records for a session. */
    @Get('sessions/:sessionId/records')
    getRecords(@Param('sessionId') sessionId: string): Promise<RecordDto[]> {
        return this.service.getRecords(sessionId);
    }

    /**
     * Attendance summary per student for a course + term.
     * Used by ClassStanding to auto-fill attendance%.
     * GET /attendance/summary?courseId=xxx&term=Prelim
     */
    @Get('summary')
    getSummary(
        @Query('courseId') courseId: string,
        @Query('term') term: string,
    ): Promise<AttendanceSummaryDto[]> {
        return this.service.getSummary(courseId, term);
    }

    /**
     * Get graded project submissions for a student/course/term.
     * Used by ClassStanding modal 'Pick from submissions' feature.
     * GET /attendance/project-scores?courseId=xxx&studentId=xxx&term=Prelim
     */
    @Get('project-scores')
    getProjectScores(
        @Query('courseId') courseId: string,
        @Query('studentId') studentId: string,
        @Query('term') term: string,
    ) {
        return this.service.getProjectSubmissions(courseId, studentId, term);
    }
}
