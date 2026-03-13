import { OmitType } from '@nestjs/swagger';
import { DepartmentRequestDto } from './department-request.dto';

// prettier-ignore
/**
 * Request payload for updating a department.
 * All fields are optional to support partial updates.
 */
export class DepartmentUpdateRequestDto extends OmitType(
    DepartmentRequestDto,
    [
        'isActive',
        'isDeleted'
    ] as const
) {

}
