import { Module } from '@nestjs/common';
import { ProgramController } from './program.controller';
import { ProgramService } from './program.service';
import { ProgramRepository } from './repository/program.repository';

@Module({
    controllers: [ProgramController],
    providers:   [ProgramService, ProgramRepository],
    exports:     [ProgramService],
})
export class ProgramModule {}
