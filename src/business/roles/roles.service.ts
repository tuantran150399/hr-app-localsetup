import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../models/role.entity';
import { Permission } from '../../models/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
  ) {}

  async create(dto: CreateRoleDto, actorId: number) {
    const exists = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Role name already exists');
    const role = this.roleRepo.create({ name: dto.name, description: dto.description, createdBy: actorId, updatedBy: actorId });
    if (dto.permissionIds?.length) role.permissions = await this.permRepo.findByIds(dto.permissionIds);
    return this.roleRepo.save(role);
  }

  findAll() {
    return this.roleRepo.find({ relations: ['permissions'] });
  }

  async findOne(id: number) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: number, dto: UpdateRoleDto, actorId: number) {
    const role = await this.findOne(id);
    if (dto.description !== undefined) role.description = dto.description;
    role.updatedBy = actorId;
    if (dto.permissionIds !== undefined) {
      role.permissions = dto.permissionIds.length ? await this.permRepo.findByIds(dto.permissionIds) : [];
    }
    return this.roleRepo.save(role);
  }

  findAllPermissions() {
    return this.permRepo.find();
  }
}