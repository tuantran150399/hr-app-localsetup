import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type DatabaseObjectRow = { name: string; type: 'BASE TABLE' | 'VIEW' };

@Injectable()
export class MaintenanceService {
  constructor(private readonly dataSource: DataSource) {}

  async dropAllTables() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const objects = await queryRunner.query(
        `SELECT TABLE_NAME AS name, TABLE_TYPE AS type
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         ORDER BY TABLE_NAME`,
      ) as DatabaseObjectRow[];
      const views = objects.filter((object) => object.type === 'VIEW');
      const tables = objects.filter((object) => object.type === 'BASE TABLE');

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        for (const view of views) {
          await queryRunner.query(`DROP VIEW IF EXISTS ${this.escapeIdentifier(view.name)}`);
        }
        for (const table of tables) {
          await queryRunner.query(`DROP TABLE IF EXISTS ${this.escapeIdentifier(table.name)}`);
        }
      } finally {
        await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
      }

      return {
        success: true,
        droppedTables: tables.length,
        droppedViews: views.length,
      };
    } finally {
      await queryRunner.release();
    }
  }

  private escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }
}
