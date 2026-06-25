import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDebitNoteLockFields1748500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('debit_notes', [
      new TableColumn({ name: 'locked_at', type: 'datetime', isNullable: true }),
      new TableColumn({ name: 'locked_by', type: 'int', isNullable: true }),
      new TableColumn({ name: 'lock_reason', type: 'text', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('debit_notes', 'lock_reason');
    await queryRunner.dropColumn('debit_notes', 'locked_by');
    await queryRunner.dropColumn('debit_notes', 'locked_at');
  }
}
