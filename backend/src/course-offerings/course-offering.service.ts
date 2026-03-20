import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseOfferingRepository } from './repository/course-offering.repository';
import {
    AutoAssignResultDto,
    CourseOfferingDto,
    CourseOfferingRow,
    CreateCourseOfferingDto,
} from './dto/course-offering.dto';

@Injectable()
export class CourseOfferingService {
    constructor(private readonly repo: CourseOfferingRepository) {}

    async create(dto: CreateCourseOfferingDto): Promise<CourseOfferingDto> {
        const offeringId = await this.repo.create(dto);
        const row = await this.repo.findById(offeringId);
        return this.toDto(row!);
    }

    async getAll(syId?: string, term?: string): Promise<CourseOfferingDto[]> {
        const rows = await this.repo.findAll(syId, term);
        return rows.map(r => this.toDto(r));
    }

    async getById(offeringId: string): Promise<CourseOfferingDto> {
        const row = await this.repo.findById(offeringId);
        if (!row) throw new NotFoundException('Course offering not found.');
        return this.toDto(row);
    }

    /**
     * Auto-assigns all eligible students to the offering's course.
     * Skips students already enrolled (any status).
     */
    async autoAssign(offeringId: string): Promise<AutoAssignResultDto> {
        const row = await this.repo.findById(offeringId);
        if (!row) throw new NotFoundException('Course offering not found.');

        const eligible   = await this.repo.findEligibleStudents(offeringId, row.yearLevel, row.programId);
        const alreadyIn  = await this.repo.findAlreadyEnrolled(row.courseId);
        const toEnroll   = eligible.filter(sid => !alreadyIn.has(sid));
        const assigned   = await this.repo.bulkEnroll(toEnroll, row.courseId, row.syLabel);
        const skipped    = eligible.length - assigned;

        // Refresh the row to get updated enrolled count
        const updated = await this.repo.findById(offeringId);

        return {
            offering: this.toDto(updated!),
            assigned,
            skipped,
        };
    }

    private toDto(row: CourseOfferingRow): CourseOfferingDto {
        return {
            offeringId:  row.offeringId,
            courseId:    row.courseId,
            courseCode:  row.courseCode,
            courseName:  row.courseName,
            syId:        row.syId,
            syLabel:     row.syLabel,
            term:        row.term,
            yearLevel:   row.yearLevel,
            programId:   row.programId,
            programName: row.programName,
            maxStudents: row.maxStudents,
            isActive:    Boolean(row.isActive),
            enrolledCount: Number(row.enrolledCount),
            createdAt:   row.createdAt,
        };
    }
}
