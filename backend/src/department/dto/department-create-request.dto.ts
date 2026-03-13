import { OmitType } from '@nestjs/swagger';
import { DepartmentRequestDto } from './department-request.dto';

// prettier-ignore
/**
 * DTO for creating a department.
 *
 * Extends the base department DTO and omits fields that are not expected
 * from the client during create requests (such as generated IDs or audit fields).
 */
export class DepartmentCreateRequestDto extends OmitType(
    DepartmentRequestDto,
    [
        'departmentId',
        'isActive',
        'isDeleted'
    ] as const
) {

}
