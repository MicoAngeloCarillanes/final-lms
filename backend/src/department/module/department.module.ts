import { Module } from '@nestjs/common';
import { DepartmentController } from '../controller/department.controller';
import { DepartmentRepository } from '../repository/department.repository';
import { DepartmentService } from '../service/department.service';

// prettier-ignore
/**
 * Department feature module.
 * Registers the department controller, service, and repository providers.
 */
@Module({
    controllers: [DepartmentController],
    providers: [DepartmentService, DepartmentRepository]
})
export class DepartmentModule {

}
