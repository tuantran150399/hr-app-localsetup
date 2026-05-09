import { MigrationInterface, QueryRunner } from 'typeorm';

export class SrsBackendCompletion1745400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS service_prices (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        partner_id INT UNSIGNED NULL,
        service_type ENUM('CUSTOMS','TRUCKING','SEA_FREIGHT','AIR_FREIGHT','LOCAL_CHARGE','LCL','OTHER') NOT NULL,
        shipment_mode VARCHAR(50) NULL,
        route_from VARCHAR(150) NULL,
        route_to VARCHAR(150) NULL,
        unit VARCHAR(50) NULL,
        min_quantity DECIMAL(18,4) NULL,
        max_quantity DECIMAL(18,4) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        amount DECIMAL(18,4) NOT NULL,
        effective_from DATE NULL,
        effective_to DATE NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        notes TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_service_prices_partner_service (partner_id, service_type),
        INDEX idx_service_prices_active (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NULL,
        employee_code VARCHAR(50) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        branch_id INT UNSIGNED NULL,
        department VARCHAR(100) NULL,
        position VARCHAR(100) NULL,
        hire_date DATE NULL,
        status ENUM('ACTIVE','INACTIVE','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
        email VARCHAR(150) NULL,
        phone VARCHAR(50) NULL,
        address TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_employees_employee_code (employee_code),
        INDEX idx_employees_branch_status (branch_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        employee_id INT UNSIGNED NOT NULL,
        work_date DATE NOT NULL,
        check_in DATETIME NULL,
        check_out DATETIME NULL,
        work_hours DECIMAL(8,2) NULL,
        status ENUM('PRESENT','ABSENT','LEAVE','HOLIDAY') NOT NULL DEFAULT 'PRESENT',
        notes TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_attendance_employee_work_date (employee_id, work_date),
        INDEX idx_attendance_work_date (work_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        employee_id INT UNSIGNED NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        date_from DATE NOT NULL,
        date_to DATE NOT NULL,
        days DECIMAL(8,2) NOT NULL,
        reason TEXT NULL,
        status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
        approved_at DATETIME NULL,
        approved_by INT UNSIGNED NULL,
        rejected_at DATETIME NULL,
        rejected_by INT UNSIGNED NULL,
        reject_reason TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_leave_employee_status (employee_id, status),
        INDEX idx_leave_dates (date_from, date_to)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payroll_records (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        employee_id INT UNSIGNED NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        base_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
        allowance DECIMAL(18,4) NOT NULL DEFAULT 0,
        deduction DECIMAL(18,4) NOT NULL DEFAULT 0,
        net_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
        status ENUM('DRAFT','POSTED','VOIDED') NOT NULL DEFAULT 'DRAFT',
        posted_at DATETIME NULL,
        posted_by INT UNSIGNED NULL,
        notes TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_payroll_employee_period (employee_id, year, month),
        INDEX idx_payroll_period_status (year, month, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_advances (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        employee_id INT UNSIGNED NOT NULL,
        job_id INT UNSIGNED NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        amount DECIMAL(18,4) NOT NULL,
        settled_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
        due_date DATE NULL,
        purpose TEXT NULL,
        status ENUM('PENDING','APPROVED','REJECTED','SETTLED','CANCELLED') NOT NULL DEFAULT 'PENDING',
        approved_at DATETIME NULL,
        approved_by INT UNSIGNED NULL,
        settled_at DATETIME NULL,
        settled_by INT UNSIGNED NULL,
        reject_reason TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_advances_employee_status (employee_id, status),
        INDEX idx_advances_due_date (due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cash_accounts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        type ENUM('CASH','BANK') NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        bank_name VARCHAR(150) NULL,
        account_number VARCHAR(100) NULL,
        balance DECIMAL(18,4) NOT NULL DEFAULT 0,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cash_accounts_code (code),
        INDEX idx_cash_accounts_type_active (type, isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        cash_account_id INT UNSIGNED NOT NULL,
        transactionType ENUM('RECEIPT','PAYMENT','ADJUSTMENT') NOT NULL,
        transaction_date DATE NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        amount DECIMAL(18,4) NOT NULL,
        description VARCHAR(200) NOT NULL,
        job_id INT UNSIGNED NULL,
        partner_id INT UNSIGNED NULL,
        reference_type VARCHAR(50) NULL,
        reference_id INT UNSIGNED NULL,
        notes TEXT NULL,
        created_by INT UNSIGNED NULL,
        updated_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_cash_transactions_account_date (cash_account_id, transaction_date),
        INDEX idx_cash_transactions_reference (reference_type, reference_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO permissions (name) VALUES
        ('pricing:view'), ('pricing:manage'),
        ('hr:view'), ('hr:manage'),
        ('advance:view'), ('advance:manage'),
        ('treasury:view'), ('treasury:manage')
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'SUPER_ADMIN'
          AND p.name IN ('pricing:view','pricing:manage','hr:view','hr:manage','advance:view','advance:manage','treasury:view','treasury:manage')
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'ACCOUNTANT'
          AND p.name IN ('pricing:view','advance:view','advance:manage','treasury:view','treasury:manage')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cash_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS cash_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS employee_advances`);
    await queryRunner.query(`DROP TABLE IF EXISTS payroll_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS attendance_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees`);
    await queryRunner.query(`DROP TABLE IF EXISTS service_prices`);
  }
}
