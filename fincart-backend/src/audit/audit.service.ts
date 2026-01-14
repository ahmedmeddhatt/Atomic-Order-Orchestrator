import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditStatus } from './enums/audit-status.enum';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async logWebhook(
    webhookId: string,
    eventType: string,
    payload: object,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      webhookId,
      eventType,
      payload,
      status: AuditStatus.RECEIVED,
    });

    const saved = await this.auditLogRepository.save(auditLog);
    this.logger.log(`Audit log created for webhook ${webhookId}`);
    return saved;
  }

  async markProcessed(webhookId: string): Promise<void> {
    await this.auditLogRepository.update(
      { webhookId },
      {
        status: AuditStatus.PROCESSED,
        processedAt: new Date(),
      },
    );
    this.logger.log(`Webhook ${webhookId} marked as processed`);
  }

  async markDiscarded(webhookId: string, reason: string): Promise<void> {
    await this.auditLogRepository.update(
      { webhookId },
      {
        status: AuditStatus.DISCARDED,
        errorMessage: reason,
        processedAt: new Date(),
      },
    );
    this.logger.warn(`Webhook ${webhookId} discarded: ${reason}`);
  }

  async markFailed(webhookId: string, errorMessage: string): Promise<void> {
    await this.auditLogRepository.update(
      { webhookId },
      {
        status: AuditStatus.FAILED,
        errorMessage,
        processedAt: new Date(),
      },
    );
    this.logger.error(`Webhook ${webhookId} failed: ${errorMessage}`);
  }

  async findByWebhookId(webhookId: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOne({ where: { webhookId } });
  }
}
