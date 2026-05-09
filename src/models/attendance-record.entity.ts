import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LEAVE = 'LEAVE',
  HOLIDAY = 'HOLIDAY',
}

@Entity('attendance_records')
@Unique(['employeeId', 'workDate'])
export class AttendanceRecord extends BaseEntity {
  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'work_date', type: 'date' })
  workDate: Date;

  @Column({ name: 'check_in', type: 'datetime', nullable: true })
  checkIn: Date;

  @Column({ name: 'check_out', type: 'datetime', nullable: true })
  checkOut: Date;

  @Column({ name: 'work_hours', type: 'decimal', precision: 8, scale: 2, nullable: true })
  workHours: number;

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
