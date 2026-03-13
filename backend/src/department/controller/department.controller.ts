// prettier-ignore
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { DepartmentCreateRequestDto } from '../dto/department-create-request.dto';
import { PageableDepartmentDto } from '../dto/department-repository.dto';
import { DepartmentSearchRequestDto } from '../dto/department-search-request.dto';
import { DepartmentUpdateRequestDto } from '../dto/department-update-request.dto';
import { DepartmentDto, DepartmentOptionDto } from '../dto/department.dto';
import { DepartmentService } from '../service/department.service';

import type { TinyIntFlag } from 'src/core/common/dto/common.dto';

/**
 * Controller for department-related endpoints.
 *
 * Handles department create, list/search, and other department operations.
 */
@Controller('department')
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    // prettier-ignore
    /**
     * Creates a new department after validating unique constraints.
     *0
     * @param requestDto the create department request payload.
     * @returns the standard response containing a success message.
     */
    @Post()
    @ApiOperation({ summary: 'Create department' })
    async create(@Body() requestDto: DepartmentCreateRequestDto): Promise<string> {
        return await this.departmentService.create(requestDto);
    }

    /**
     * Returns active department options for select/dropdown inputs.
     *
     * @returns the standard response containing active department options.
     */
    @Get('options')
    @ApiOperation({ summary: 'Get active department options' })
    getActiveOptions(): Promise<DepartmentOptionDto[]> {
        return this.departmentService.getActiveOptions();
    }

    // prettier-ignore
    /**
     * Returns a paginated department list using optional field-based search filters.
     *
     * @param requestDto the department search and pagination request payload.
     * @returns the standard response containing paginated department results.
     */
    @Post('list')
    @ApiOperation({ summary: 'Get pageable departments' })
    @HttpCode(HttpStatus.OK)
    getList(@Body() requestDto: DepartmentSearchRequestDto): Promise<PageableDepartmentDto> {
        return this.departmentService.getList(requestDto);
    }

    // prettier-ignore
    /**
     * Returns department details by ID.
     *
     * @param departmentId the department ID from the route parameter.
     * @returns the department row.
     * @throws BadRequestException when departmentId is not a valid number (via ParseIntPipe).
     * @throws NotFoundException when the department does not exist.
     */
    @Get(':departmentId')
    async getById(@Param('departmentId', ParseIntPipe) departmentId: number): Promise<DepartmentDto> {
        return this.departmentService.getByIdOrThrow(departmentId);
    }

    // prettier-ignore
    /**
     * Updates a department by ID.
     *
     * @param departmentId the department ID from the route parameter.
     * @param requestDto the department update payload.
     * @returns the standard message.
     * @throws NotFoundException when the department does not exist.
     */
    @Put()
    async updateById(@Body() requestDto: DepartmentUpdateRequestDto): Promise<string> {
        return this.departmentService.updateById(requestDto);
    }

    // prettier-ignore
    /**
     * Updates the active flag of a department.
     * Used to activate or deactivate a department without deleting it.
     *
     * @param departmentId the department ID to update.
     * @param requestDto the active flag update request payload.
     * @returns a success message.
     */
    @Patch(':departmentId/:isActive')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update department active status' })
    public updateIsActive(
        @Param('departmentId', ParseIntPipe) departmentId: number,
        @Param('isActive', ParseIntPipe) isActive: TinyIntFlag
    ): Promise<string> {
        return this.departmentService.updateIsActiveById(departmentId, isActive);
    }

    // prettier-ignore
    /**
     * Soft deletes a department by ID.
     *
     * @param departmentId the department ID to soft delete.
     * @returns a success message.
     */
    @Delete(':departmentId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete department' })
    deleteById(@Param('departmentId', ParseIntPipe) departmentId: number): Promise<string> {
        return this.departmentService.deleteById(departmentId);
    }
}
