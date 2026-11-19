import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaimsController } from './claims.controller';
import { ClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClaimsController],
  providers: [ClaimsRepository, ClaimsService],
})
export class ClaimsModule {}
