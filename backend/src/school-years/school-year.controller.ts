import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { SchoolYearService } from './school-year.service';
import {
    CreateSchoolYearDto,
    UpsertTermPeriodsDto,
    SchoolYearDto,
    TermPeriodDto,
} from './dto/school-year.dto';

@Controller('school-years')
export class SchoolYearController {
    constructor(private readonly service: SchoolYearService) {}

    /** Create a new school year. */
    @Post()
    create(@Body() dto: CreateSchoolYearDto): Promise<SchoolYearDto> {
        return this.service.create(dto);
    }

    /** List all school years (no terms). */
    @Get()
    getAll(): Promise<SchoolYearDto[]> {
        return this.service.getAll();
    }

    /** Get one SY with its term periods. */
    @Get(':syId')
    getWithTerms(@Param('syId') syId: string): Promise<SchoolYearDto> {
        return this.service.getWithTerms(syId);
    }

    /** Set a school year as the active one (deactivates all others). */
    @Put(':syId/set-active')
    @HttpCode(HttpStatus.OK)
    setActive(@Param('syId') syId: string): Promise<string> {
        return this.service.setActive(syId);
    }

    /** Upsert term date ranges for a school year. */
    @Post(':syId/terms')
    upsertTerms(
        @Param('syId') syId: string,
        @Body() dto: UpsertTermPeriodsDto,
    ): Promise<string> {
        return this.service.upsertTermPeriods(syId, dto);
    }

    /** Get term periods for a school year. */
    @Get(':syId/terms')
    getTerms(@Param('syId') syId: string): Promise<TermPeriodDto[]> {
        return this.service.getTermsBySy(syId);
    }

    /**
     * Returns the current term string based on today's date and the active SY.
     * Clients should use this instead of hardcoded termFromDate().
     */
    @Get('active/current-term')
    getCurrentTerm(): Promise<{ term: string | null }> {
        return this.service.getCurrentTerm();
    }
}
