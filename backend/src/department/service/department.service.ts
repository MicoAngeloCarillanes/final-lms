// prettier-ignore
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
// prettier-ignore
import { NumberNullUndefined, TinyIntFlag } from 'src/core/common/dto/common.dto';
import { stringValueOrEmpty } from 'src/core/common/util/clean.util';
import { DepartmentCreateRequestDto } from '../dto/department-create-request.dto';
// prettier-ignore
import { DepartmentDuplicateField, PageableDepartmentDto } from '../dto/department-repository.dto';
import { DepartmentSearchRequestDto } from '../dto/department-search-request.dto';
import { DepartmentUpdateRequestDto } from '../dto/department-update-request.dto';
import { DepartmentDto, DepartmentOptionDto } from '../dto/department.dto';
// prettier-ignore
import { DepartmentRepository } from '../repository/department.repository';

interface UniqueColumnParams {
    // Column name
    name: DepartmentDuplicateField;

    // Column value
    value?: string;
}

/**
 * Department service.
 * Handles business logic and validation for department operations.
 */
@Injectable()
export class DepartmentService {
    constructor(private readonly departmentRepository: DepartmentRepository) {}

    // prettier-ignore
    /**
     * Creates a new department after validating unique constraints.
     *
     * @param requestDto the create department request payload.
     * @return the standard response containing a success message.
     * @throws ConflictException when code, name, email, or phone already exists.
     * @throws Error when the insert operation fails.
     */
    async create(requestDto: DepartmentCreateRequestDto): Promise<string> {
        const {code, name, email, phone} = requestDto;

        await this.validateFieldUniqueness(code, name, email, phone);

        if (await this.departmentRepository.create(requestDto)) {
            return 'Department created successfully.';
        } else {
            throw new Error('Failed to create department.');
        }
    }

    // prettier-ignore
    /**
     * Returns the department list using optional field-based search filters.
     *
     * @param requestDto the department search request payload.
     * @return the standard response containing the department list.
     */
    async getList(requestDto: DepartmentSearchRequestDto): Promise<PageableDepartmentDto> {
        return await this.departmentRepository.findList(requestDto);
    }

    // prettier-ignore
    /**
     * Retrieves department by its ID and whetehr.
     *
     * @param departmentId the department primary key.
     * @param isDeleted the delete flag.
     * @returns the department row.
     * @throws NotFoundException when the department is not found.
     */
    async getByIdOrThrow(
        departmentId: NumberNullUndefined,
        isDeleted: TinyIntFlag = 1
    ): Promise<DepartmentDto> {
        const department = await this.departmentRepository.findById(departmentId, isDeleted);

        if (!department) {
            throw new NotFoundException('Department not found.');
        }

        return department;
    }

    // prettier-ignore
    /**
     * Returns active department options for select/dropdown inputs.
     *
     * @returns the standard response containing active department options.
     */
    async getActiveOptions(): Promise<DepartmentOptionDto[]> {
        return await this.departmentRepository.findActiveDepartmentOptions();
    }

    // prettier-ignore
    /**
     * Updates an existing active department by ID.
     * First validates that the department exists and is not soft-deleted.
     * Then applies the update using the provided payload and returns the updated row.
     *
     * @param requestDto the department fields to update.
     * @returns the updated department row.
     * @throws NotFoundException when the department is not found.
     */
    async updateById(requestDto: DepartmentUpdateRequestDto): Promise<string> {
        const {departmentId, code, name, email, phone} = requestDto;

        await this.getByIdOrThrow(departmentId, 0);
        await this.validateFieldUniqueness(code, name, email, phone, departmentId);

        if (await this.departmentRepository.updateById(requestDto)) {
            return 'Department updated successfully.';
        } else {
            throw new Error('Failed to create department.');
        }
    }

    // prettier-ignore
    /**
     * Updates the active flag of a department.
     * This is used to temporarily activate/deactivate a department without deleting it.
     *
     * @param departmentId the department ID to update.
     * @param isActive the active flag value (1 = active, 0 = inactive).
     * @returns a success message.
     * @throws NotFoundException when the department is not found or already deleted.
     */
    public async updateIsActiveById(
        departmentId: number,
        isActive: TinyIntFlag
    ): Promise<string> {
        if (await this.departmentRepository.updateIsActiveById(
            departmentId,
            isActive
        )) {
            return isActive === 1
            ? 'Department activated successfully.'
            : 'Department deactivated successfully.';
        }

        throw new NotFoundException('Department not found.');
    }

    // prettier-ignore
    /**
     * Soft deletes a department by ID.
     *
     * Deleting a department also deactivates it by setting is_active = 0.
     *
     * @param departmentId the department ID to soft delete.
     * @returns a success message.
     * @throws NotFoundException when the department is not found or already deleted.
     */
    async deleteById(departmentId: number): Promise<string> {
        if (await this.departmentRepository.softDeleteById(departmentId)) {
            return 'Department deleted successfully.';
        }

        throw new NotFoundException('Department not found.');
    }

    // prettier-ignore
    /**
     * Validates department unique fields before creating a new department.
     *
     * Checks the code, name, email, and phone values against existing non-deleted
     * department records and throws a conflict error when a duplicate is found.
     *
     * @param code the department code to validate.
     * @param name the department name to validate.
     * @param email the department email to validate.
     * @param phone the department phone to validate.
     * @throws ConflictException when any duplicate value is found.
     */
    private async validateFieldUniqueness(
        code?: string,
        name?: string,
        email?: string,
        phone?: string,
        departmentId?: number
    ) {
        const uniqueColumns: UniqueColumnParams[] = [
            {name: 'code', value: code},
            {name: 'name', value: name},
            {name: 'email', value: email},
            {name: 'phone', value: phone}
        ];

        for (const {name, value} of uniqueColumns) {
            if (await this.departmentRepository.existByFieldAndDepartmentIdNot(name, stringValueOrEmpty(value), departmentId)) {
                throw new ConflictException(`Department ${name} already exists.`);
            }
        }
    }
}
