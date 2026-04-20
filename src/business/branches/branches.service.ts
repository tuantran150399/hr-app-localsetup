import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../models/branch.entity';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(@InjectRepository(Branch) private repo: Repository<Branch>) {}

  async create(dto: CreateBranchDto, actorId: number) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Branch code already exists');
    return this.repo.save(this.repo.create({ ...dto, createdBy: actorId, updatedBy: actorId }));
  }

  findAll() { return this.repo.find({ order: { name: 'ASC' } }); }

  async findOne(id: number) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  async update(id: number, dto: UpdateBranchDto, actorId: number) {
    const b = await this.findOne(id);
    return this.repo.save({ ...b, ...dto, updatedBy: actorId });
  }
}