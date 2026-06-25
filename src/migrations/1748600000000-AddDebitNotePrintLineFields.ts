import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDebitNotePrintLineFields1748600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('debit_notes', new TableColumn({
      name: 'group_code',
      type: 'varchar',
      length: '100',
      isNullable: true,
    }));

    await queryRunner.addColumns('debit_note_lines', [
      new TableColumn({ name: 'charge_note', type: 'varchar', length: '200', isNullable: true }),
      new TableColumn({ name: 'line_note', type: 'text', isNullable: true }),
      new TableColumn({
        name: 'credit_amount',
        type: 'decimal',
        precision: 18,
        scale: 4,
        default: 0,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('debit_note_lines', 'credit_amount');
    await queryRunner.dropColumn('debit_note_lines', 'line_note');
    await queryRunner.dropColumn('debit_note_lines', 'charge_note');
    await queryRunner.dropColumn('debit_notes', 'group_code');
  }
}
