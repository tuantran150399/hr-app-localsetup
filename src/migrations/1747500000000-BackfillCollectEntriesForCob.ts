import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillCollectEntriesForCob1747500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO cob_entries (
        type,
        vendor_id,
        partner_id,
        job_id,
        cost_entry_id,
        receivable_entry_id,
        related_cob_entry_id,
        currency,
        amount,
        description,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      SELECT
        'COLLECT_ON_BEHALF',
        c.vendor_id,
        c.partner_id,
        c.job_id,
        c.cost_entry_id,
        c.receivable_entry_id,
        c.id,
        c.currency,
        c.amount,
        CONCAT('Auto collect-on-behalf from COB #', c.id, ': ', COALESCE(c.description, '')),
        c.status,
        c.created_by,
        c.updated_by,
        c.created_at,
        c.updated_at
      FROM cob_entries c
      LEFT JOIN cob_entries existing
        ON existing.related_cob_entry_id = c.id
       AND existing.type = 'COLLECT_ON_BEHALF'
      WHERE c.type = 'CHARGE_ON_BEHALF'
        AND c.related_cob_entry_id IS NULL
        AND existing.id IS NULL
    `);

    await queryRunner.query(`
      UPDATE cob_entries charge
      JOIN cob_entries collect
        ON collect.related_cob_entry_id = charge.id
       AND collect.type = 'COLLECT_ON_BEHALF'
      SET charge.related_cob_entry_id = collect.id
      WHERE charge.type = 'CHARGE_ON_BEHALF'
        AND charge.related_cob_entry_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE cob_entries charge
      JOIN cob_entries collect
        ON collect.id = charge.related_cob_entry_id
       AND collect.type = 'COLLECT_ON_BEHALF'
      SET charge.related_cob_entry_id = NULL
      WHERE charge.type = 'CHARGE_ON_BEHALF'
        AND collect.description LIKE CONCAT('Auto collect-on-behalf from COB #', charge.id, ':%')
    `);

    await queryRunner.query(`
      DELETE collect FROM cob_entries collect
      WHERE collect.type = 'COLLECT_ON_BEHALF'
        AND collect.related_cob_entry_id IS NOT NULL
        AND collect.description LIKE CONCAT('Auto collect-on-behalf from COB #', collect.related_cob_entry_id, ':%')
    `);
  }
}
