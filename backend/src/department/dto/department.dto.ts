// prettier-ignore
import { PickType } from '@nestjs/swagger';
// prettier-ignore
import { DateNull, NumberNull, StringNull, TinyIntFlag } from 'src/core/common/dto/common.dto';

/**
 * DTO for department responses.
 *
 * Represents department data returned to the client using camelCase fields.
 */
export class DepartmentDto {
    // Primary key of the department.
    departmentId!: number;

    // Unique department code.
    code!: string;

    // Department name.
    name!: string;

    // Department room/office.
    room!: StringNull;

    // Department email address.
    email!: StringNull;

    // Department contact number.
    phone!: StringNull;

    // Additional department description.
    description!: StringNull;

    // Active flag (true = active, false = inactive).
    isActive!: TinyIntFlag;

    // Soft delete flag (true = deleted, false = not deleted).
    isDeleted!: TinyIntFlag;

    // User ID who created the record.
    createdBy!: NumberNull;

    // Date/time when the record was created.
    createdDate!: Date;

    // User ID who last updated the record.
    updatedBy!: NumberNull;

    // Date/time when the record was last updated.
    updatedDate!: DateNull;
}

// prettier-ignore
/**
 * DTO for department select/dropdown options.
 *
 * Contains only the minimum department fields needed for selection inputs.
 */
export class DepartmentOptionDto extends PickType(
    DepartmentDto,
    [
        'departmentId',
        'name'
    ] as const
) {

}
