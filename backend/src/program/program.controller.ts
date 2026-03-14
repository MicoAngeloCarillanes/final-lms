// prettier-ignore
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgramService } from './program.service';
import { ProgramCreateRequestDto } from './dto/program-create-request.dto';
import { ProgramUpdateRequestDto } from './dto/program-update-request.dto';
import { ProgramSearchRequestDto } from './dto/program-search-request.dto';
import { PageableProgramDto, ProgramDto, ProgramOptionDto } from './dto/program.dto';

@ApiTags('Program')
@Controller('program')
export class ProgramController {
    constructor(private readonly programService: ProgramService) {}

    @Post()
    @ApiOperation({ summary: 'Create program' })
    create(@Body() dto: ProgramCreateRequestDto): Promise<string> {
        return this.programService.create(dto);
    }

    @Get('options')
    @ApiOperation({ summary: 'Get active program options' })
    getOptions(): Promise<ProgramOptionDto[]> {
        return this.programService.getActiveOptions();
    }

    @Post('list')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get pageable programs' })
    getList(@Body() dto: ProgramSearchRequestDto): Promise<PageableProgramDto> {
        return this.programService.getList(dto);
    }

    @Get(':programId')
    @ApiOperation({ summary: 'Get program by ID' })
    getById(@Param('programId', ParseIntPipe) programId: number): Promise<ProgramDto> {
        return this.programService.getById(programId);
    }

    @Put()
    @ApiOperation({ summary: 'Update program' })
    updateById(@Body() dto: ProgramUpdateRequestDto): Promise<string> {
        return this.programService.updateById(dto);
    }

    @Patch(':programId/:isActive')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Toggle program active status' })
    setActive(
        @Param('programId', ParseIntPipe) programId: number,
        @Param('isActive',  ParseIntPipe) isActive: 0 | 1
    ): Promise<string> {
        return this.programService.setActive(programId, isActive);
    }

    @Delete(':programId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete program' })
    deleteById(@Param('programId', ParseIntPipe) programId: number): Promise<string> {
        return this.programService.deleteById(programId);
    }
}
