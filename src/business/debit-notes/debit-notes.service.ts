import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import { existsSync } from 'fs';
import { DebitNote, DebitNoteStatus } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { ServicePrice } from '../../models/service-price.entity';
import { Job } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { AccountingStatus, PaymentStatus, RevenueEntry } from '../../models/revenue-entry.entity';
import { CreateDebitNoteDto, UpdateDebitNoteDto, VoidDebitNoteDto, DebitNoteFilterDto, RecordDebitNotePaymentDto } from './dto/debit-note.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { assertBranchAccess, AuthenticatedUser, getScopedBranchId } from '../../common/auth/branch-scope.util';

@Injectable()
export class DebitNotesService {
  constructor(
    @InjectRepository(DebitNote) private noteRepo: Repository<DebitNote>,
    @InjectRepository(DebitNoteLine) private lineRepo: Repository<DebitNoteLine>,
    @InjectRepository(ServicePrice) private priceRepo: Repository<ServicePrice>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    private dataSource: DataSource,
    private auditSvc: AuditLogsService,
  ) {}

  private enforceBranchAccess(user: AuthenticatedUser | undefined, branchId?: number | null) {
    try {
      assertBranchAccess(user, branchId);
    } catch {
      throw new ForbiddenException('You cannot access debit notes from another branch');
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateDebitNoteDto, actor: AuthenticatedUser) {
    const saved = await this.dataSource.transaction(async (em) => {
      const job = await this.assertJob(dto.jobId);
      this.enforceBranchAccess(actor, job.branchId);
      const totalAmount = this.calculateLineTotal(dto.lineItems, dto.amount);
      const note = await em.save(DebitNote, em.create(DebitNote, {
        partnerId: job.partnerId,
        jobId: job.id,
        currency: dto.currency || 'VND',
        docDate: dto.docDate ? new Date(dto.docDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        description: dto.description,
        paymentMethod: dto.paymentMethod || null,
        paymentAccountRef: dto.paymentAccountRef || null,
        paymentStatus: PaymentStatus.UNPAID,
        paidAmount: 0,
        amount: totalAmount,
        status: DebitNoteStatus.POSTED,
        postedAt: new Date(),
        postedBy: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      }));

      await this.saveLineItems(em, note.id, dto.lineItems || [], note.currency);
      return this.syncReceivable(em, note, actor.id);
    });

    await this.auditSvc.log({
      entityName: 'DebitNote', entityId: saved.id, action: 'CREATE', userId: actor.id,
      newValues: { partnerId: saved.partnerId, jobId: saved.jobId, amount: saved.amount, lineCount: dto.lineItems?.length || 0, receivableEntryId: saved.receivableEntryId },
    });

    return saved;
  }

  async findAll(filter: DebitNoteFilterDto = {}, actor?: AuthenticatedUser) {
    const { page = 1, limit = 50, status, partnerId, jobId, branchId } = filter;
    const scopedBranchId = getScopedBranchId(actor, branchId);
    const qb = this.noteRepo.createQueryBuilder('dn')
      .innerJoin(Job, 'j', 'j.id = dn.jobId');
    if (scopedBranchId) qb.andWhere('j.branchId = :branchId', { branchId: scopedBranchId });
    if (status) qb.andWhere('dn.status = :status', { status });
    if (partnerId) qb.andWhere('dn.partnerId = :partnerId', { partnerId });
    if (jobId) qb.andWhere('dn.jobId = :jobId', { jobId });
    qb.orderBy('dn.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number, actor?: AuthenticatedUser) {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Debit note not found');
    await this.enforceNoteBranchAccess(note, actor);
    const lines = await this.lineRepo.find({ where: { debitNoteId: id }, order: { id: 'ASC' } });
    return { ...note, lineItems: lines };
  }

  async update(id: number, dto: UpdateDebitNoteDto, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (![DebitNoteStatus.DRAFT, DebitNoteStatus.POSTED].includes(note.status) || note.paymentStatus !== PaymentStatus.UNPAID) {
      throw new BadRequestException('Only unpaid draft/posted debit notes can be edited');
    }

    return this.dataSource.transaction(async (em) => {
      const job = dto.jobId ? await this.assertJob(dto.jobId) : await this.assertJob(note.jobId);
      this.enforceBranchAccess(actor, job.branchId);
      Object.assign(note, {
        partnerId: job.partnerId,
        jobId: job.id,
        currency: dto.currency ?? note.currency,
        docDate: dto.docDate ? new Date(dto.docDate) : note.docDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : note.dueDate,
        description: dto.description ?? note.description,
        paymentMethod: dto.paymentMethod ?? note.paymentMethod,
        paymentAccountRef: dto.paymentAccountRef ?? note.paymentAccountRef,
        amount: dto.lineItems ? this.calculateLineTotal(dto.lineItems, dto.amount) : dto.amount ?? note.amount,
        updatedBy: actor.id,
      });

      const saved = await em.save(DebitNote, note);
      if (dto.lineItems) {
        await em.delete(DebitNoteLine, { debitNoteId: id });
        await this.saveLineItems(em, id, dto.lineItems, saved.currency);
      }
      return this.syncReceivable(em, saved, actor.id);
    });
  }

  async delete(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be deleted');
    }
    await this.lineRepo.delete({ debitNoteId: id });
    await this.noteRepo.delete(id);
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'DELETE', userId: actor.id });
    return { deleted: true };
  }

  // ─── Workflow ────────────────────────────────────────────────────────────

  async post(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be posted');
    }
    note.status = DebitNoteStatus.POSTED;
    note.postedAt = new Date();
    note.postedBy = actor.id;
    note.updatedBy = actor.id;
    const saved = await this.noteRepo.save(note);
    await this.dataSource.transaction((em) => this.syncReceivable(em, saved, actor.id));
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'POST', userId: actor.id });
    return this.findOne(id, actor);
  }

  async send(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status !== DebitNoteStatus.POSTED) {
      throw new BadRequestException('Only POSTED debit notes can be sent');
    }
    note.status = DebitNoteStatus.SENT;
    note.sentAt = new Date();
    note.sentBy = actor.id;
    note.updatedBy = actor.id;
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'SEND', userId: actor.id });
    return this.noteRepo.save(note);
  }

  async void(id: number, reason: string, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status === DebitNoteStatus.VOIDED) {
      throw new BadRequestException('Debit note is already voided');
    }
    const oldStatus = note.status;
    note.status = DebitNoteStatus.VOIDED;
    note.voidedAt = new Date();
    note.voidedBy = actor.id;
    note.voidReason = reason;
    note.updatedBy = actor.id;
    if (note.receivableEntryId) {
      await this.revenueRepo.update(note.receivableEntryId, {
        status: AccountingStatus.VOIDED,
        voidedAt: new Date(),
        voidedBy: actor.id,
        updatedBy: actor.id,
      });
    }
    await this.auditSvc.log({
      entityName: 'DebitNote', entityId: id, action: 'VOID', userId: actor.id,
      oldValues: { status: oldStatus }, newValues: { status: 'VOIDED', reason },
    });
    return this.noteRepo.save(note);
  }

  async recordPayment(id: number, dto: RecordDebitNotePaymentDto, actor: AuthenticatedUser) {
    const saved = await this.dataSource.transaction(async (em) => {
      const note = await em.findOne(DebitNote, { where: { id } });
      if (!note) throw new NotFoundException('Debit note not found');
      await this.enforceNoteBranchAccess(note, actor);
      if (!note.receivableEntryId) {
        await this.syncReceivable(em, note, actor.id);
      }
      const receivableId = note.receivableEntryId;
      const paidAmount = Number(note.paidAmount || 0) + Number(dto.amount || 0);
      const paymentStatus = paidAmount >= Number(note.amount || 0) ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
      const paidAt = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

      const updated = await em.save(DebitNote, {
        ...note,
        paymentStatus,
        paymentMethod: dto.paymentMethod,
        paymentAccountRef: dto.paymentAccountRef || null,
        paidAmount,
        paidAt,
        paidBy: actor.id,
        updatedBy: actor.id,
      });

      if (receivableId) {
        await em.update(RevenueEntry, receivableId, {
          paymentStatus,
          paymentMethod: dto.paymentMethod,
          paymentAccountRef: dto.paymentAccountRef || null,
          updatedBy: actor.id,
        });
      }
      return updated;
    });

    await this.auditSvc.log({
      entityName: 'DebitNote',
      entityId: id,
      action: 'RECORD_PAYMENT',
      userId: actor.id,
      newValues: { amount: dto.amount, paymentMethod: dto.paymentMethod, paymentStatus: saved.paymentStatus },
    });
    return this.findOne(id, actor);
  }

  // ─── Pricing Lookup ──────────────────────────────────────────────────────

  async exportExcel(id: number, actor?: AuthenticatedUser) {
    const context = await this.buildExportContext(id, actor);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Debit Note');

    worksheet.columns = [
      { key: 'label', width: 24 },
      { key: 'value', width: 42 },
      { key: 'serviceType', width: 18 },
      { key: 'description', width: 44 },
      { key: 'quantity', width: 12 },
      { key: 'unitPrice', width: 18 },
      { key: 'amount', width: 18 },
    ];

    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = `DEBIT NOTE ${context.noteNo}`;
    worksheet.getCell('A1').font = { bold: true, size: 18 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    const infoRows = [
      ['Customer', context.partner?.name || '-'],
      ['Tax Code', context.partner?.taxCode || '-'],
      ['Address', context.partner?.address || '-'],
      ['Job No.', context.job?.jobCode || '-'],
      ['Branch', context.branch?.name || '-'],
      ['Document Date', this.formatDate(context.note.docDate)],
      ['Due Date', this.formatDate(context.note.dueDate)],
      ['Payment Method', context.note.paymentMethod || '-'],
      ['Payment Status', context.note.paymentStatus || '-'],
      ['Description', context.note.description || '-'],
    ];

    let rowIndex = 3;
    for (const [label, value] of infoRows) {
      const row = worksheet.getRow(rowIndex);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true };
      worksheet.mergeCells(rowIndex, 2, rowIndex, 7);
      row.getCell(2).value = value;
      row.getCell(2).alignment = { wrapText: true };
      rowIndex += 1;
    }

    rowIndex += 1;
    const header = worksheet.getRow(rowIndex);
    ['', '', 'Service', 'Description', 'Qty', 'Unit Price', 'Amount'].forEach((value, index) => {
      const cell = header.getCell(index + 1);
      cell.value = value;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FF' } };
      cell.border = this.excelBorder();
    });

    for (const line of context.lines) {
      rowIndex += 1;
      const row = worksheet.getRow(rowIndex);
      row.getCell(3).value = line.serviceType || '-';
      row.getCell(4).value = line.description || '-';
      row.getCell(5).value = Number(line.quantity || 0);
      row.getCell(6).value = Number(line.unitPrice || 0);
      row.getCell(7).value = Number(line.amount || 0);
      [3, 4, 5, 6, 7].forEach((column) => {
        row.getCell(column).border = this.excelBorder();
        row.getCell(column).alignment = { wrapText: true };
      });
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
    }

    rowIndex += 1;
    worksheet.mergeCells(rowIndex, 3, rowIndex, 6);
    worksheet.getCell(rowIndex, 3).value = 'Total';
    worksheet.getCell(rowIndex, 3).font = { bold: true };
    worksheet.getCell(rowIndex, 3).alignment = { horizontal: 'right' };
    worksheet.getCell(rowIndex, 7).value = Number(context.note.amount || 0);
    worksheet.getCell(rowIndex, 7).font = { bold: true };
    worksheet.getCell(rowIndex, 7).numFmt = '#,##0';

    const buffer = await workbook.xlsx.writeBuffer();
    return { fileName: `${context.noteNo}.xlsx`, buffer: Buffer.from(buffer) };
  }

  async exportPdf(id: number, actor?: AuthenticatedUser) {
    const context = await this.buildExportContext(id, actor);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    this.registerPdfFont(doc);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(18).text(`DEBIT NOTE ${context.noteNo}`, { align: 'center' });
    doc.moveDown();
    this.pdfInfoLine(doc, 'Customer', context.partner?.name || '-');
    this.pdfInfoLine(doc, 'Tax Code', context.partner?.taxCode || '-');
    this.pdfInfoLine(doc, 'Address', context.partner?.address || '-');
    this.pdfInfoLine(doc, 'Job No.', context.job?.jobCode || '-');
    this.pdfInfoLine(doc, 'Branch', context.branch?.name || '-');
    this.pdfInfoLine(doc, 'Document Date', this.formatDate(context.note.docDate));
    this.pdfInfoLine(doc, 'Due Date', this.formatDate(context.note.dueDate));
    this.pdfInfoLine(doc, 'Payment Method', context.note.paymentMethod || '-');
    this.pdfInfoLine(doc, 'Payment Status', context.note.paymentStatus || '-');
    if (context.note.description) this.pdfInfoLine(doc, 'Description', context.note.description);

    doc.moveDown();
    let y = doc.y;
    this.pdfTableRow(doc, y, ['Service', 'Description', 'Qty', 'Unit Price', 'Amount'], true);
    y += 24;

    for (const line of context.lines) {
      if (y > 720) {
        doc.addPage();
        y = 40;
        this.pdfTableRow(doc, y, ['Service', 'Description', 'Qty', 'Unit Price', 'Amount'], true);
        y += 24;
      }
      this.pdfTableRow(doc, y, [
        line.serviceType || '-',
        line.description || '-',
        String(line.quantity || 0),
        this.formatMoney(line.unitPrice),
        this.formatMoney(line.amount),
      ]);
      y += 24;
    }

    doc.moveTo(390, y + 10).lineTo(555, y + 10).stroke();
    doc.fontSize(11).text('Total', 390, y + 18, { width: 80, align: 'right' });
    doc.fontSize(11).text(`${this.formatMoney(context.note.amount)} ${context.note.currency || 'VND'}`, 470, y + 18, { width: 85, align: 'right' });
    doc.end();

    return { fileName: `${context.noteNo}.pdf`, buffer: await done };
  }

  async lookupPricing(partnerId?: number, jobId?: number, actor?: AuthenticatedUser) {
    let selectedJob: Job | null = null;
    if (jobId) {
      selectedJob = await this.assertJob(jobId);
      this.enforceBranchAccess(actor, selectedJob.branchId);
      partnerId = selectedJob.partnerId || partnerId;
    }

    const origin = this.normalizeText(selectedJob?.origin || selectedJob?.pol);
    const destination = this.normalizeText(selectedJob?.destination || selectedJob?.pod);
    const items = partnerId ? await this.findPrioritizedCustomerPrices(partnerId, origin, destination) : [];
    return { data: items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findOneOrFail(id: number): Promise<DebitNote> {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Debit note not found');
    return note;
  }

  private async enforceNoteBranchAccess(note: DebitNote, actor?: AuthenticatedUser) {
    if (!note.jobId) return;
    const job = await this.jobRepo.findOne({ where: { id: note.jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${note.jobId} not found`);
    this.enforceBranchAccess(actor, job.branchId);
  }

  private async assertJob(jobId?: number): Promise<Job> {
    if (!jobId) throw new BadRequestException('Job is required to create a Debit Note');
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${jobId} not found`);
    if (!job.partnerId) throw new BadRequestException(`Job #${jobId} does not have a customer`);
    return job;
  }

  private calculateLineTotal(lineItems: CreateDebitNoteDto['lineItems'], fallbackAmount?: number) {
    if (!lineItems?.length) return Number(fallbackAmount || 0);
    return lineItems.reduce((sum, item) => {
      const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
      return sum + lineAmount;
    }, 0);
  }

  private async saveLineItems(em: EntityManager, debitNoteId: number, lineItems: CreateDebitNoteDto['lineItems'], currency: string) {
    if (!lineItems?.length) return;
    const lines = lineItems.map((item) => {
      const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
      return em.create(DebitNoteLine, {
        debitNoteId,
        serviceType: item.serviceType,
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        amount: lineAmount,
        currency: item.currency || currency || 'VND',
        pricingId: item.pricingId,
      });
    });
    await em.save(DebitNoteLine, lines);
  }

  private async syncReceivable(em: EntityManager, note: DebitNote, userId: number) {
    const receivablePayload = {
      jobId: note.jobId,
      description: `Debit Note DN-${note.id}: ${note.description || ''}`,
      currency: note.currency || 'VND',
      amount: note.amount,
      exchangeRate: 1,
      localAmount: note.amount,
      status: AccountingStatus.POSTED,
      paymentStatus: note.paymentStatus || PaymentStatus.UNPAID,
      paymentMethod: note.paymentMethod || null,
      paymentAccountRef: note.paymentAccountRef || null,
      refNumber: `DN-${note.id}`,
      invoiceNumber: `DN-${note.id}`,
      docDate: note.docDate,
      dueDate: note.dueDate,
      postedAt: note.postedAt || new Date(),
      postedBy: note.postedBy || userId,
      updatedBy: userId,
    };

    let receivable: RevenueEntry;
    if (note.receivableEntryId) {
      await em.update(RevenueEntry, note.receivableEntryId, receivablePayload);
      receivable = await em.findOneOrFail(RevenueEntry, { where: { id: note.receivableEntryId } });
    } else {
      receivable = await em.save(RevenueEntry, em.create(RevenueEntry, { ...receivablePayload, createdBy: userId }));
      note.receivableEntryId = receivable.id;
      note.updatedBy = userId;
      await em.save(DebitNote, note);
    }
    return { ...note, receivableEntryId: receivable.id };
  }

  private async buildExportContext(id: number, actor?: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    const [lines, job, partner] = await Promise.all([
      this.lineRepo.find({ where: { debitNoteId: id }, order: { id: 'ASC' } }),
      this.jobRepo.findOne({ where: { id: note.jobId } }),
      this.partnerRepo.findOne({ where: { id: note.partnerId } }),
    ]);
    const branch = job?.branchId ? await this.branchRepo.findOne({ where: { id: job.branchId } }) : null;
    return { note, lines, job, partner, branch, noteNo: `DN-${note.id}` };
  }

  private excelBorder() {
    return {
      top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
    };
  }

  private formatDate(value?: Date | string | null) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toISOString().slice(0, 10);
  }

  private formatMoney(value?: number | string | null) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  private registerPdfFont(doc: any) {
    const fontPath = 'C:/Windows/Fonts/arial.ttf';
    if (existsSync(fontPath)) {
      doc.registerFont('AppRegular', fontPath);
      doc.font('AppRegular');
    }
  }

  private pdfInfoLine(doc: any, label: string, value: string) {
    doc.fontSize(10).text(`${label}: `, { continued: true });
    doc.text(value || '-');
  }

  private pdfTableRow(doc: any, y: number, values: string[], header = false) {
    const columns = [
      { x: 40, width: 80, align: 'left' },
      { x: 120, width: 210, align: 'left' },
      { x: 330, width: 45, align: 'right' },
      { x: 375, width: 90, align: 'right' },
      { x: 465, width: 90, align: 'right' },
    ];

    doc.fontSize(header ? 10 : 9);
    columns.forEach((column, index) => {
      if (header) doc.rect(column.x, y, column.width, 24).fillAndStroke('#EAF2FF', '#D9D9D9');
      else doc.rect(column.x, y, column.width, 24).stroke('#D9D9D9');
      doc.fillColor('#111111').text(values[index] || '-', column.x + 4, y + 7, {
        width: column.width - 8,
        align: column.align,
        lineBreak: false,
      });
    });
  }

  private normalizeText(value?: string): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private async findPrioritizedCustomerPrices(partnerId: number, origin: string, destination: string): Promise<ServicePrice[]> {
    const baseQb = () => this.priceRepo.createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.partnerId = :partnerId', { partnerId })
      .andWhere('(p.effectiveFrom IS NULL OR p.effectiveFrom <= CURDATE())')
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= CURDATE())')
      .orderBy('p.serviceType', 'ASC')
      .addOrderBy('p.effectiveFrom', 'DESC');

    if (origin && destination) {
      const routePrices = await baseQb()
        .andWhere('LOWER(TRIM(p.routeFrom)) = :origin', { origin })
        .andWhere('LOWER(TRIM(p.routeTo)) = :destination', { destination })
        .getMany();
      if (routePrices.length) return routePrices;
    }

    return baseQb()
      .andWhere('(p.routeFrom IS NULL OR TRIM(p.routeFrom) = \'\')')
      .andWhere('(p.routeTo IS NULL OR TRIM(p.routeTo) = \'\')')
      .getMany();
  }
}
