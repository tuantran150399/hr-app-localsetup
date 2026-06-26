import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { DebitNote, DebitNoteStatus } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { ServicePrice } from '../../models/service-price.entity';
import { Job, JobStatus } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { AccountingStatus, PaymentStatus, RevenueEntry } from '../../models/revenue-entry.entity';
import { CreateDebitNoteDto, UpdateDebitNoteDto, VoidDebitNoteDto, DebitNoteFilterDto, RecordDebitNotePaymentDto } from './dto/debit-note.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { assertBranchAccess, AuthenticatedUser, getScopedBranchId } from '../../common/auth/branch-scope.util';

@Injectable()
export class DebitNotesService {
  private pdfFonts = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
  };

  constructor(
    @InjectRepository(DebitNote) private noteRepo: Repository<DebitNote>,
    @InjectRepository(DebitNoteLine) private lineRepo: Repository<DebitNoteLine>,
    @InjectRepository(ServicePrice) private priceRepo: Repository<ServicePrice>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(User) private userRepo: Repository<User>,
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

  private isAdmin(user?: AuthenticatedUser) {
    return (user?.roles || []).some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateDebitNoteDto, actor: AuthenticatedUser) {
    const saved = await this.dataSource.transaction(async (em) => {
      const jobs = await this.resolveDebitNoteJobs(dto);
      const primaryJob = jobs[0];
      jobs.forEach((job) => this.enforceBranchAccess(actor, job.branchId));
      await this.validateLineItemsAgainstPricing(em, dto.lineItems || []);
      const totalAmount = this.calculateLineTotal(dto.lineItems, dto.amount);
      const note = await em.save(DebitNote, em.create(DebitNote, {
        partnerId: primaryJob.partnerId,
        jobId: primaryJob.id,
        currency: dto.currency || 'VND',
        docDate: dto.docDate ? new Date(dto.docDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        referenceNo: dto.referenceNo || null,
        groupCode: dto.groupCode || null,
        paymentTerm: dto.paymentTerm || null,
        movingType: dto.movingType || null,
        direction: dto.direction || null,
        mblNo: dto.mblNo || null,
        exportNote: dto.exportNote || null,
        bankName: dto.bankName || null,
        bankAccountNo: dto.bankAccountNo || null,
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

      await this.saveLineItems(em, note.id, dto.lineItems || [], note.currency, primaryJob.id);
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
    const jobIds = this.collectDebitNoteJobIds(note, lines);
    return { ...note, jobIds, lineItems: lines };
  }

  async update(id: number, dto: UpdateDebitNoteDto, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.lockedAt && !this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can edit a locked debit note');
    }
    if (![DebitNoteStatus.DRAFT, DebitNoteStatus.POSTED].includes(note.status) || note.paymentStatus !== PaymentStatus.UNPAID) {
      throw new BadRequestException('Only unpaid draft/posted debit notes can be edited');
    }

    return this.dataSource.transaction(async (em) => {
      const jobs = await this.resolveDebitNoteJobs(dto, note.jobId);
      const primaryJob = jobs[0];
      jobs.forEach((job) => this.enforceBranchAccess(actor, job.branchId));
      if (dto.lineItems) {
        await this.validateLineItemsAgainstPricing(em, dto.lineItems);
      }
      Object.assign(note, {
        partnerId: primaryJob.partnerId,
        jobId: primaryJob.id,
        currency: dto.currency ?? note.currency,
        docDate: dto.docDate ? new Date(dto.docDate) : note.docDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : note.dueDate,
        referenceNo: dto.referenceNo ?? note.referenceNo,
        groupCode: dto.groupCode ?? note.groupCode,
        paymentTerm: dto.paymentTerm ?? note.paymentTerm,
        movingType: dto.movingType ?? note.movingType,
        direction: dto.direction ?? note.direction,
        mblNo: dto.mblNo ?? note.mblNo,
        exportNote: dto.exportNote ?? note.exportNote,
        bankName: dto.bankName ?? note.bankName,
        bankAccountNo: dto.bankAccountNo ?? note.bankAccountNo,
        description: dto.description ?? note.description,
        paymentMethod: dto.paymentMethod ?? note.paymentMethod,
        paymentAccountRef: dto.paymentAccountRef ?? note.paymentAccountRef,
        amount: dto.lineItems ? this.calculateLineTotal(dto.lineItems, dto.amount) : dto.amount ?? note.amount,
        updatedBy: actor.id,
      });

      const saved = await em.save(DebitNote, note);
      if (dto.lineItems) {
        await em.delete(DebitNoteLine, { debitNoteId: id });
        await this.saveLineItems(em, id, dto.lineItems, saved.currency, primaryJob.id);
      }
      return this.syncReceivable(em, saved, actor.id);
    });
  }

  async delete(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.lockedAt) {
      throw new BadRequestException('Locked debit notes cannot be deleted');
    }
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
        lockedAt: paymentStatus === PaymentStatus.PAID ? note.lockedAt || new Date() : note.lockedAt,
        lockedBy: paymentStatus === PaymentStatus.PAID ? note.lockedBy || actor.id : note.lockedBy,
        lockReason: paymentStatus === PaymentStatus.PAID ? note.lockReason || 'Locked after receipt/payment was recorded' : note.lockReason,
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
      if (paymentStatus === PaymentStatus.PAID) {
        const lines = await em.find(DebitNoteLine, { where: { debitNoteId: note.id } });
        const jobIds = this.collectDebitNoteJobIds(note, lines);
        if (jobIds.length) {
          await em.update(Job, { id: In(jobIds) }, { status: JobStatus.CLOSED, closedAt: new Date(), closedBy: actor.id, updatedBy: actor.id });
        }
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
    const jobCodes = this.formatJobCodes(context.jobs);
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
      ['Job No.', jobCodes],
      ['Branch', context.branch?.name || '-'],
      ['Reference No.', context.note.referenceNo || `Invoice${this.formatDebitRef(context.note.id)}`],
      ['Document Date', this.formatDate(context.note.docDate)],
      ['Due Date', this.formatDate(context.note.dueDate)],
      ['Payment Term', context.note.paymentTerm || this.resolvePaymentTerm(context.note)],
      ['Moving Type', context.note.movingType || this.resolveMovingType(context.job)],
      ['Direction', context.note.direction || this.resolveDirection(context.job)],
      ['MBL No.', context.note.mblNo || context.job?.mbl || '-'],
      ['Payment Method', context.note.paymentMethod || '-'],
      ['Payment Status', context.note.paymentStatus || '-'],
      ['Export Note', context.note.exportNote || context.note.description || '-'],
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
      const lineJob = this.resolveLineJob(context, line);
      row.getCell(3).value = line.serviceType || '-';
      row.getCell(4).value = [lineJob?.jobCode, line.description || '-'].filter(Boolean).join(' - ');
      row.getCell(5).value = Number(line.quantity || 0);
      row.getCell(6).value = line.chargeNote || `${this.formatMoney(line.unitPrice)} ${line.currency || context.note.currency || 'VND'}/${this.resolveLineUnit(lineJob)}`;
      row.getCell(7).value = Number(line.amount || 0) - Number(line.creditAmount || 0) + Number(line.vatAmount || 0);
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
    const printedBy = await this.resolvePrintedBy(actor);
    const doc = new PDFDocument({ margin: 20, size: 'A4', bufferPages: true });
    this.registerPdfFont(doc);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const left = 24;
    const right = 571;
    const blue = '#C8D8EE';
    const border = '#D0D0D0';
    const preTax = context.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const totalCredit = context.lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0);
    const totalVat = context.lines.reduce((sum, line) => sum + Number(line.vatAmount || 0), 0);
    const totalAmount = preTax - totalCredit + totalVat;
    const noteDate = this.formatLongDate(context.note.docDate || context.note.createdAt);
    const dueDate = this.formatLongDate(context.note.dueDate);
    const vessel = [context.job?.vesselName, context.job?.voyageNo].filter(Boolean).join(' / ');
    const eta = this.formatLongDate(context.job?.eta);
    const containerText = this.buildContainerText(context.job);
    const jobCodes = this.formatJobCodes(context.jobs);

    doc.lineWidth(1).rect(1, 1, 593, 840).stroke('#222222');

    this.drawCompanyHeader(doc, context);
    this.setPdfFont(doc, 'bold');
    doc.fillColor('#000080').fontSize(18).text('DEBIT NOTE', 450, 50, { width: 105, align: 'right' });
    this.setPdfFont(doc);
    doc.fillColor('#111111');

    const topY = 132;
    doc.fontSize(10).text('Messrs:', 28, topY);
    this.setPdfFont(doc, 'bold');
    doc.text(context.partner?.name || '-', 76, topY, { width: 275 });
    this.setPdfFont(doc);
    doc.text(context.partner?.address || '-', 76, topY + 14, { width: 300, height: 34 });
    doc.fontSize(8);
    this.setPdfFont(doc, 'italic');
    doc.text('Customer ID: ' + (context.partner?.code || '-'), 76, topY + 50, { width: 220 });
    this.setPdfFont(doc);

    this.pdfMiniInfo(doc, 404, topY, 'Ref', context.note.referenceNo || `Invoice${this.formatDebitRef(context.note.id)}`);
    this.pdfMiniInfo(doc, 404, topY + 15, 'Date', noteDate);
    this.pdfMiniInfo(doc, 404, topY + 30, 'Job', jobCodes);

    const detailY = 203;
    const detailRows = [
      ['Vsl./Flight.', vessel || '-'],
      ['ETA', eta],
      ['P.O.L', context.job?.pol || context.job?.origin || '-'],
      ['P.O.D', context.job?.pod || context.job?.destination || '-'],
      ['MBL No.', context.note.mblNo || context.job?.mbl || '-'],
      ['Volume', this.formatMeasurement(context.job?.volumeCbm, 'CBM')],
      ['Weight', this.formatMeasurement(context.job?.weightKg, 'KG')],
    ];
    detailRows.forEach((row, index) => {
      const y = detailY + index * 14;
      doc.fontSize(10).text(row[0], 28, y, { width: 70 });
      doc.text(':', 99, y);
      doc.text(row[1], 109, y, { width: 220 });
    });

    doc.rect(346, 198, 225, 102).stroke(border);
    this.setPdfFont(doc, 'bold');
    doc.fontSize(10).text('Note:', 350, 203);
    this.setPdfFont(doc);
    doc.fontSize(10).text(
      [context.note.exportNote || context.note.description, containerText].filter(Boolean).join('\n') || '-',
      350,
      229,
      { width: 214, height: 64 }
    );

    const summaryY = 306;
    this.pdfSummaryRow(doc, summaryY, ['Moving Type', 'Direction', 'Terms', 'Due Date'], blue, true);
    this.pdfSummaryRow(doc, summaryY + 24, [
      context.note.movingType || this.resolveMovingType(context.job),
      context.note.direction || this.resolveDirection(context.job),
      context.note.paymentTerm || this.resolvePaymentTerm(context.note),
      dueDate,
    ], '#FFFFFF', false);

    let y = 360;
    this.drawDebitHeader(doc, y, blue);
    y += 20;

    const groupCode = context.note.groupCode || context.job?.declarationNo || context.job?.bookingRef || context.job?.jobCode || context.noteNo;
    doc.rect(left, y, right - left, 18).stroke(border);
    this.setPdfFont(doc, 'bold');
    doc.fontSize(8).text(groupCode, left + 3, y + 5, { width: 190 });
    this.setPdfFont(doc);
    y += 18;

    for (const line of context.lines) {
      const debitColumns = this.debitPdfColumns();
      const rowHeight = Math.max(
        26,
        this.estimateRowHeight(doc, line.description || '-', debitColumns[0].width - 8),
        this.estimateRowHeight(doc, line.chargeNote || '', debitColumns[1].width - 8),
        this.estimateRowHeight(doc, line.lineNote || '', debitColumns[3].width - 8),
      );
      if (y + rowHeight + 82 > 790) {
        doc.addPage();
        doc.rect(1, 1, 593, 840).stroke('#222222');
        y = 32;
        this.drawDebitHeader(doc, y, blue);
        y += 20;
      }
      this.drawDebitLine(doc, y, rowHeight, line, context);
      y += rowHeight;
    }

    if (y + 104 > 790) {
      doc.addPage();
      doc.rect(1, 1, 593, 840).stroke('#222222');
      y = 32;
    }

    this.drawTotalRow(doc, y, 'Pre-tax Total:', preTax, preTax - totalCredit, false);
    y += 24;
    this.drawPaymentAndTaxBlock(doc, y, context, totalAmount);
    y += 52;

    this.setPdfFont(doc);
    doc.fontSize(7.5).text('Say :', 27, y + 6, { width: 34 });
    doc.text(`${this.amountToEnglishWords(totalAmount)} ${context.note.currency || 'VND'}`, 65, y + 6, { width: 492 });
    y += 24;

    if (y + 152 > 790) {
      doc.addPage();
      doc.rect(1, 1, 593, 840).stroke('#222222');
      y = 32;
    }

    this.drawCompanyPaymentFooter(doc, y, printedBy);
    this.drawPdfPageNumbers(doc);
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
    const lines = await this.lineRepo.find({ where: { debitNoteId: note.id } });
    const jobIds = this.collectDebitNoteJobIds(note, lines);
    if (!jobIds.length) return;

    const jobs = await this.jobRepo.find({ where: { id: In(jobIds) } });
    if (jobs.length !== jobIds.length) throw new BadRequestException('One or more jobs were not found');
    jobs.forEach((job) => {
      if (job.archivedAt) throw new BadRequestException(`Job #${job.id} not found`);
      this.enforceBranchAccess(actor, job.branchId);
    });
  }

  private async assertJob(jobId?: number): Promise<Job> {
    if (!jobId) throw new BadRequestException('Job is required to create a Debit Note');
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${jobId} not found`);
    if (!job.partnerId) throw new BadRequestException(`Job #${jobId} does not have a customer`);
    return job;
  }

  private async resolveDebitNoteJobs(dto: Pick<CreateDebitNoteDto, 'jobId' | 'jobIds' | 'lineItems'>, fallbackJobId?: number): Promise<Job[]> {
    const ids = [
      ...(dto.jobIds || []),
      dto.jobId,
      ...(dto.lineItems || []).map((line) => line.jobId),
      fallbackJobId,
    ].filter((value): value is number => Number.isFinite(Number(value)))
      .map((value) => Number(value));

    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) throw new BadRequestException('At least one job is required to create a Debit Note');

    const jobs = await this.jobRepo.find({ where: { id: In(uniqueIds) } });
    if (jobs.length !== uniqueIds.length) throw new BadRequestException('One or more jobs were not found');
    const archived = jobs.find((job) => job.archivedAt);
    if (archived) throw new BadRequestException(`Job #${archived.id} not found`);

    const partnerIds = [...new Set(jobs.map((job) => job.partnerId).filter(Boolean))];
    if (partnerIds.length !== 1) throw new BadRequestException('All jobs in a Debit Note must belong to the same customer');

    return uniqueIds.map((jobId) => jobs.find((job) => job.id === jobId)!);
  }

  private collectDebitNoteJobIds(note: DebitNote, lines: DebitNoteLine[]) {
    return [...new Set([note.jobId, ...lines.map((line) => line.jobId)].filter(Boolean))];
  }

  private calculateLineTotal(lineItems: CreateDebitNoteDto['lineItems'], fallbackAmount?: number) {
    if (!lineItems?.length) return Number(fallbackAmount || 0);
    return lineItems.reduce((sum, item) => {
      const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
      const vatAmount = Number(item.vatAmount || 0) || lineAmount * (Number(item.vatRate || 0) / 100);
      const creditAmount = Number(item.creditAmount || 0);
      return sum + lineAmount - creditAmount + vatAmount;
    }, 0);
  }

  private async validateLineItemsAgainstPricing(em: EntityManager, lineItems: CreateDebitNoteDto['lineItems']) {
    if (!lineItems?.length) return;

    const pricingIds = [...new Set(lineItems.map((item) => item.pricingId).filter((id): id is number => Number.isFinite(id)))];
    if (!pricingIds.length) return;

    const prices = await em.find(ServicePrice, { where: { id: In(pricingIds) } });
    const priceMap = new Map(prices.map((price) => [price.id, price]));

    lineItems.forEach((item, index) => {
      if (!item.pricingId) return;

      const price = priceMap.get(item.pricingId);
      if (!price) {
        throw new BadRequestException(`Pricing #${item.pricingId} not found for line ${index + 1}`);
      }

      const quantity = Number(item.quantity || 1);
      const minQuantity = price.minQuantity === null || price.minQuantity === undefined ? null : Number(price.minQuantity);
      const maxQuantity = price.maxQuantity === null || price.maxQuantity === undefined ? null : Number(price.maxQuantity);

      if (minQuantity !== null && quantity < minQuantity) {
        throw new BadRequestException(`Line ${index + 1} quantity is below the minimum allowed (${minQuantity})`);
      }

      if (maxQuantity !== null && quantity > maxQuantity) {
        throw new BadRequestException(`Line ${index + 1} quantity exceeds the maximum allowed (${maxQuantity})`);
      }
    });
  }

  private async saveLineItems(em: EntityManager, debitNoteId: number, lineItems: CreateDebitNoteDto['lineItems'], currency: string, fallbackJobId: number) {
    if (!lineItems?.length) return;
    const lines = lineItems.map((item) => {
      const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
      const creditAmount = Number(item.creditAmount || 0);
      const vatRate = Number(item.vatRate || 0);
      const vatAmount = Number(item.vatAmount || 0) || lineAmount * (vatRate / 100);
      return em.create(DebitNoteLine, {
        debitNoteId,
        jobId: item.jobId || fallbackJobId,
        serviceType: item.serviceType,
        description: item.description,
        chargeNote: item.chargeNote,
        lineNote: item.lineNote,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        amount: lineAmount,
        creditAmount,
        vatRate,
        vatAmount,
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
    const [lines, partner] = await Promise.all([
      this.lineRepo.find({ where: { debitNoteId: id }, order: { id: 'ASC' } }),
      this.partnerRepo.findOne({ where: { id: note.partnerId } }),
    ]);
    const jobIds = this.collectDebitNoteJobIds(note, lines);
    const jobs = jobIds.length ? await this.jobRepo.find({ where: { id: In(jobIds) } }) : [];
    const jobMap = new Map(jobs.map((job) => [job.id, job]));
    const job = (note.jobId ? jobMap.get(note.jobId) : null) || jobs[0] || null;
    const branch = job?.branchId ? await this.branchRepo.findOne({ where: { id: job.branchId } }) : null;
    return { note, lines, job, jobs: jobIds.map((jobId) => jobMap.get(jobId)).filter(Boolean), jobMap, partner, branch, noteNo: `DN-${note.id}` };
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

  private formatDebitRef(id: number) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}/${id}`;
  }

  private formatLongDate(value?: Date | string | null) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).format(date);
  }

  private formatMeasurement(value?: number | string | null, unit = '') {
    if (value === null || value === undefined || value === '') return '-';
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0) return '-';
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(amount)} ${unit}`.trim();
  }

  private registerPdfFont(doc: any) {
    const candidates = {
      regular: ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'],
      bold: ['C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
      italic: ['C:/Windows/Fonts/ariali.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'],
    };

    (Object.keys(candidates) as Array<keyof typeof candidates>).forEach((style) => {
      const path = candidates[style].find((item) => existsSync(item));
      if (path) {
        const name = `App${style}`;
        doc.registerFont(name, path);
        this.pdfFonts[style] = name;
      }
    });

    this.setPdfFont(doc);
  }

  private setPdfFont(doc: any, style: keyof typeof this.pdfFonts = 'regular') {
    doc.font(this.pdfFonts[style] || this.pdfFonts.regular);
  }

  private drawCompanyHeader(doc: any, context: Awaited<ReturnType<typeof this.buildExportContext>>) {
    const logoPath = path.resolve(__dirname, '../../assets/images/duongminh.png');
    if (existsSync(logoPath)) {
      const logoBuffer = readFileSync(logoPath);
      doc.image(logoBuffer, 8, 36, { width: 132, height: 62 });
    }

    this.setPdfFont(doc, 'bold');
    doc.fillColor('#111111').fontSize(12).text('Cong ty Co Phan Giao Nhan Van Tai Quoc Te Duong', 144, 38, { width: 330 });
    doc.text('Minh', 144, 53, { width: 280 });
    this.setPdfFont(doc);
    doc.fontSize(9).text(context.branch?.address || '59 Tran Dinh Xu, Phuong Cau kho, Quan 1, Tp Ho chi Minh, VIETNAM', 144, 70, { width: 350 });
    doc.text('Tel :84-2838371177    Fax : 84-2838371199', 144, 83, { width: 330 });
    doc.text('Email : Info@duongminhvn.com', 144, 96, { width: 260 });
  }

  private pdfMiniInfo(doc: any, x: number, y: number, label: string, value: string) {
    doc.fillColor('#111111').fontSize(10).text(label, x, y, { width: 35 });
    doc.text(':', x + 36, y, { width: 8 });
    doc.text(value || '-', x + 49, y, { width: 126 });
  }

  private formatJobCodes(jobs: Job[]) {
    return jobs.map((job) => job.jobCode).filter(Boolean).join(', ') || '-';
  }

  private resolveLineJob(context: Awaited<ReturnType<typeof this.buildExportContext>>, line: DebitNoteLine) {
    return (line.jobId ? context.jobMap.get(line.jobId) : null) || context.job;
  }

  private pdfSummaryRow(doc: any, y: number, values: string[], fill: string, header: boolean) {
    const columns = [
      { x: 24, width: 132 },
      { x: 156, width: 143 },
      { x: 299, width: 136 },
      { x: 435, width: 136 },
    ];
    columns.forEach((column, index) => {
      doc.rect(column.x, y, column.width, 24).fillAndStroke(fill, '#D0D0D0');
      doc.fillColor('#111111').fontSize(10);
      this.setPdfFont(doc, header ? 'bold' : 'regular');
      doc.text(values[index] || '-', column.x + 4, y + 7, { width: column.width - 8, align: 'center' });
    });
    this.setPdfFont(doc);
  }

  private drawDebitHeader(doc: any, y: number, fill: string) {
    const columns = this.debitPdfColumns();
    const titles = ['Description', 'Charge Note', "Q'ty", 'Note', 'Debit', 'Credit', 'VAT', 'Amount'];
    columns.forEach((column, index) => {
      doc.rect(column.x, y, column.width, 20).fillAndStroke(fill, '#D0D0D0');
      this.setPdfFont(doc, 'bold');
      doc.fillColor('#111111').fontSize(7.5).text(titles[index], column.x + 2, y + 6, {
        width: column.width - 6,
        align: 'center',
      });
    });
    this.setPdfFont(doc);
  }

  private drawDebitLine(doc: any, y: number, height: number, line: DebitNoteLine, context: Awaited<ReturnType<typeof this.buildExportContext>>) {
    const columns = this.debitPdfColumns();
    const lineJob = this.resolveLineJob(context, line);
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const amount = Number(line.amount || 0);
    const creditAmount = Number(line.creditAmount || 0);
    const vatAmount = Number(line.vatAmount || 0);
    const values = [
      [lineJob?.jobCode, line.description || line.serviceType || '-'].filter(Boolean).join(' - '),
      line.chargeNote || `${this.formatMoney(unitPrice)} ${line.currency || context.note.currency || 'VND'}/${this.resolveLineUnit(lineJob)}`,
      quantity ? `${this.formatMoney(quantity)} x ${this.resolveLineUnit(lineJob)}` : '-',
      line.lineNote || '',
      this.formatMoney(amount),
      creditAmount ? this.formatMoney(creditAmount) : '',
      this.formatMoney(vatAmount),
      this.formatMoney(amount - creditAmount + vatAmount),
    ];
    columns.forEach((column, index) => {
      doc.rect(column.x, y, column.width, height).stroke('#D0D0D0');
      doc.fillColor('#111111').fontSize(7.5).text(values[index], column.x + 2, y + 4, {
        width: column.width - 4,
        height: height - 6,
        align: index >= 4 ? 'right' : index === 2 || index === 3 ? 'center' : 'left',
      });
    });
  }

  private drawTotalRow(doc: any, y: number, label: string, debit: number, amount: number, bold: boolean) {
    const columns = this.debitPdfColumns();
    columns.forEach((column) => doc.rect(column.x, y, column.width, 24).stroke('#D0D0D0'));
    this.setPdfFont(doc, bold ? 'bold' : 'regular');
    doc.fillColor('#111111').fontSize(8).text(label, columns[0].x + 3, y + 7, {
      width: columns[0].width + columns[1].width + columns[2].width - 6,
      align: 'right',
    });
    doc.text(this.formatMoney(debit), columns[4].x + 3, y + 7, { width: columns[4].width - 6, align: 'right' });
    doc.text(this.formatMoney(amount), columns[7].x + 3, y + 7, { width: columns[7].width - 6, align: 'right' });
    this.setPdfFont(doc);
  }

  private drawPaymentAndTaxBlock(doc: any, y: number, context: Awaited<ReturnType<typeof this.buildExportContext>>, totalAmount: number) {
    doc.rect(24, y, 249, 52).stroke('#D0D0D0');
    doc.fontSize(8).fillColor('#111111').text('Please make payment to:', 27, y + 5);
    doc.text('Bank Name', 27, y + 18);
    doc.text('Account No.', 27, y + 31);
    doc.text(context.note.bankName || '-', 86, y + 18, { width: 180 });
    doc.text(context.note.bankAccountNo || context.note.paymentAccountRef || '-', 86, y + 31, { width: 180 });

    doc.rect(273, y, 298, 26).stroke('#D0D0D0');
    doc.rect(273, y + 26, 298, 26).stroke('#D0D0D0');
    const totalVat = context.lines.reduce((sum, line) => sum + Number(line.vatAmount || 0), 0);
    doc.text('Tax:', 305, y + 8, { width: 60, align: 'right' });
    doc.text(this.formatMoney(totalVat), 514, y + 8, { width: 52, align: 'right' });
    this.setPdfFont(doc, 'bold');
    doc.text('Total:', 305, y + 34, { width: 60, align: 'right' });
    doc.text(this.formatMoney(totalAmount), 514, y + 34, { width: 52, align: 'right' });
    this.setPdfFont(doc);
  }

  private drawCompanyPaymentFooter(doc: any, y: number, printedBy: string) {
    const left = 14;
    this.setPdfFont(doc, 'bold');
    doc.fillColor('#111111').fontSize(7.2).text('DUONG MINH LOGISTICS CO.,LTD', left, y, { width: 560 });
    doc.text('ADD: 417/49/32 QUANG TRUNG, WARD 10, GO VAP DIST, HCM CITY, VIETNAM', left, y + 9, { width: 560 });
    doc.text('TEL: 84-8-38371177 - FAX: 84-8-38371199', left, y + 18, { width: 560 });

    const bankRows = [
      ['TAX CODE', '0312 581 864'],
      ['VND ACCOUNT NO', '114000135911'],
      ['USD ACCOUNT NO', '112000204147'],
      ['BANK NAME', 'VIETINBANK - HO CHI MINH CITY BRANCH'],
      ['BANK ADD', '79A HAM NGHI STREET, DIST.1, HCM CITY'],
      ['SWIFT CODE', 'ICBVVNVX900'],
    ];

    bankRows.forEach(([label, value], index) => {
      const rowY = y + 31 + index * 8.5;
      doc.text(label, left, rowY, { width: 112 });
      doc.text(':', left + 112, rowY, { width: 8 });
      doc.text(value, left + 122, rowY, { width: 420 });
    });

    this.setPdfFont(doc);
    const signY = y + 84;
    doc.fontSize(7).text('E.&.O.E', left, signY, { width: 120 });
    doc.text('Authorized Signature', left, signY + 13, { width: 160 });

    this.drawBranchFooter(doc, y + 109);

    const printY = Math.min(y + 143, 778);
    doc.fontSize(5.8).fillColor('#111111').text(`Print by:${printedBy || '-'}`, left, printY, { width: 220, lineBreak: false });
    doc.text(this.formatPrintDateTime(new Date()), left, printY + 8, { width: 220, lineBreak: false });
    this.setPdfFont(doc);
  }

  private drawBranchFooter(doc: any, startY: number) {
    const rows = [
      ['HEAD OFFICE', '59 Tran Dinh Xu, Cau Kho Ward, Dist. 1, HCM City, Viet Nam', 'Tel: 84.8-3837 1177 - Fax: 84.8-3837 119'],
      ['BRANCH HCM', '417/49/32 Quang Trung Str., Ward 10, Go Vap Dist., HCMC , Viet Nam', 'Tel: 84.8-3837 2363 - Fax: 84.8-3837 119'],
      ['BRANCH BINH THUAN', 'Phu Khanh Village, Ham My Commune, Ham Thuan Nam Dist., Binh Thuan', 'Pro-Tel: 062 3899 199. Fax: 062 3899 198'],
    ];
    rows.forEach(([label, address, contact], index) => {
      const rowY = startY + index * 11;
      doc.save();
      doc.fillColor('#D34242').moveTo(16, rowY).lineTo(23, rowY + 5.5).lineTo(16, rowY + 11).closePath().fill();
      doc.restore();
      this.setPdfFont(doc, 'bold');
      doc.fillColor('#D34242').fontSize(5.4).text(label, 29, rowY + 2, { width: 72 });
      doc.fillColor('#111111').text(address, 102, rowY + 2, { width: 304 });
      doc.text(contact, 421, rowY + 2, { width: 150, align: 'left' });
    });
    this.setPdfFont(doc);
  }

  private async resolvePrintedBy(actor?: AuthenticatedUser) {
    if (!actor?.id) return actor?.username || '-';
    const user = await this.userRepo.findOne({ where: { id: actor.id } });
    return user?.fullName || user?.username || actor.username || `User #${actor.id}`;
  }

  private drawPdfPageNumbers(doc: any) {
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      this.setPdfFont(doc);
      doc.fillColor('#111111').fontSize(5.8).text(`${index + 1} of ${range.count}`, 543, 804, {
        width: 38,
        align: 'right',
        lineBreak: false,
      });
    }
  }

  private formatPrintDateTime(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date).replace(',', '');
  }

  private debitPdfColumns() {
    return [
      { x: 24, width: 108 },
      { x: 132, width: 88 },
      { x: 220, width: 55 },
      { x: 275, width: 70 },
      { x: 345, width: 62 },
      { x: 407, width: 54 },
      { x: 461, width: 48 },
      { x: 509, width: 62 },
    ];
  }

  private estimateRowHeight(doc: any, text: string, width: number) {
    this.setPdfFont(doc);
    doc.fontSize(7.5);
    return Math.ceil(doc.heightOfString(text || '-', { width, align: 'left' })) + 9;
  }

  private resolveMovingType(job?: Job | null) {
    const value = job?.shipmentMode || job?.jobType || '';
    if (String(value).includes('ROAD')) return 'Ground';
    if (String(value).includes('AIR')) return 'Air';
    if (String(value).includes('SEA')) return 'Sea';
    return job?.shipmentMode || 'Ground';
  }

  private resolveDirection(job?: Job | null) {
    if (job?.jobType === 'IMPORT') return 'Import';
    if (job?.jobType === 'EXPORT') return 'Export';
    if (job?.jobType === 'DOMESTIC') return 'Logistics';
    return 'Logistics';
  }

  private resolvePaymentTerm(note: DebitNote) {
    return note.paymentMethod === 'CASH' ? 'Cash' : 'At sight';
  }

  private resolveLineUnit(job?: Job | null) {
    const unit = String(job?.cargoUnit || '').toLowerCase();
    if (unit.includes('container') || unit.includes('cont')) return '40';
    if (unit.includes('kg')) return 'KG';
    if (unit.includes('cbm')) return 'CBM';
    if (unit.includes('ton')) return 'TON';
    return 'LOT';
  }

  private buildContainerText(job?: Job | null) {
    const parts = [
      job?.containerNo,
      [job?.sealNo ? `SEAL ${job.sealNo}` : '', job?.cargoType].filter(Boolean).join(' - '),
      [job?.origin || job?.pol, job?.destination || job?.pod].filter(Boolean).join(' - '),
    ].filter(Boolean);
    return parts.join('\n');
  }

  private amountToEnglishWords(value: number) {
    const amount = Math.round(Number(value || 0));
    if (amount === 0) return 'ZERO';
    const belowTwenty = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const convert = (num: number): string => {
      if (num < 20) return belowTwenty[num];
      if (num < 100) return [tens[Math.floor(num / 10)], belowTwenty[num % 10]].filter(Boolean).join(' ');
      if (num < 1000) return [belowTwenty[Math.floor(num / 100)], 'HUNDRED', convert(num % 100)].filter(Boolean).join(' ');
      if (num < 1000000) return [convert(Math.floor(num / 1000)), 'THOUSAND', convert(num % 1000)].filter(Boolean).join(' ');
      if (num < 1000000000) return [convert(Math.floor(num / 1000000)), 'MILLION', convert(num % 1000000)].filter(Boolean).join(' ');
      return [convert(Math.floor(num / 1000000000)), 'BILLION', convert(num % 1000000000)].filter(Boolean).join(' ');
    };
    return convert(amount).replace(/\s+/g, ' ').trim();
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
