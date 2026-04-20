import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner, PartnerType } from '../../models/partner.entity';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(@InjectRepository(Partner) private repo: Repository<Partner>) {}

  async create(dto: CreatePartnerDto, actorId: number) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Partner code already exists');
    return this.repo.save(this.repo.create({ ...dto, createdBy: actorId, updatedBy: actorId }));
  }

  findAll(partnerType?: PartnerType) {
    const where = partnerType ? { partnerType } : {};
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }

  async update(id: number, dto: UpdatePartnerDto, actorId: number) {
    const p = await this.findOne(id);
    return this.repo.save({ ...p, ...dto, updatedBy: actorId });
  }
}