import { RowDataPacket } from 'mysql2/promise';

export class CreateCourseOfferingDto {
    courseId: string;      // UUID
    syId: string;          // UUID of school_year
    term: string;          // Prelim | Midterm | Semi-Final | Finals
    yearLevel?: string;    // e.g. '1st Year'
    programId?: number;
    maxStudents?: number;
}

export interface CourseOfferingRow extends RowDataPacket {
    offeringId: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    syId: string;
    syLabel: string;
    term: string;
    yearLevel: string | null;
    programId: number | null;
    programName: string | null;
    maxStudents: number;
    isActive: number;
    enrolledCount: number;
    createdAt: string;
}

export interface CourseOfferingDto {
    offeringId: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    syId: string;
    syLabel: string;
    term: string;
    yearLevel: string | null;
    programId: number | null;
    programName: string | null;
    maxStudents: number;
    isActive: boolean;
    enrolledCount: number;
    createdAt: string;
}

export interface AutoAssignResultDto {
    offering: CourseOfferingDto;
    assigned: number;
    skipped: number;
}
