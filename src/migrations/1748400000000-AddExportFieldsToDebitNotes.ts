import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExportFieldsToDebitNotes1748400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('debit_notes', [
      new TableColumn({ name: 'reference_no', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'payment_term', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'moving_type', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'direction', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'mbl_no', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'export_note', type: 'text', isNullable: true }),
      new TableColumn({ name: 'bank_name', type: 'varchar', length: '150', isNullable: true }),
      new TableColumn({ name: 'bank_account_no', type: 'varchar', length: '100', isNullable: true }),
    ]);

    await queryRunner.addColumns('debit_note_lines', [
      new TableColumn({
        name: 'vat_rate',
        type: 'decimal',
        precision: 8,
        scale: 4,
        default: 0,
      }),
      new TableColumn({
        name: 'vat_amount',
        type: 'decimal',
        precision: 18,
        scale: 4,
        default: 0,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('debit_note_lines', 'vat_amount');
    await queryRunner.dropColumn('debit_note_lines', 'vat_rate');
    await queryRunner.dropColumn('debit_notes', 'bank_account_no');
    await queryRunner.dropColumn('debit_notes', 'bank_name');
    await queryRunner.dropColumn('debit_notes', 'export_note');
    await queryRunner.dropColumn('debit_notes', 'mbl_no');
    await queryRunner.dropColumn('debit_notes', 'direction');
    await queryRunner.dropColumn('debit_notes', 'moving_type');
    await queryRunner.dropColumn('debit_notes', 'payment_term');
    await queryRunner.dropColumn('debit_notes', 'reference_no');
  }
}
