import { Kafka, Consumer } from 'kafkajs';
import { prisma } from '../lib/prisma';
import { logger } from '@eventsphere/common';
import { notificationsSentTotal } from '../index';
import { DomainEvent, EventEnvelope } from '@eventsphere/contracts';
import { MockEmailProvider, MockSMSProvider } from '../providers/mock.provider';

export class NotificationService {
  private kafka: Kafka;
  private consumer: Consumer;
  private emailProvider = new MockEmailProvider();
  private smsProvider = new MockSMSProvider();

  constructor() {
    this.kafka = new Kafka({
      clientId: 'notification-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    this.consumer = this.kafka.consumer({ groupId: 'notification-group' });
  }

  async startListening() {
    await this.consumer.connect();
    
    // Subscribe to multiple topics
    await this.consumer.subscribe({ topics: [
      DomainEvent.ORDER_CONFIRMED,
      DomainEvent.PAYMENT_SUCCESS,
      DomainEvent.TICKET_GENERATED
    ], fromBeginning: true });

    logger.info('Notification Service listening for domain events...');

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        
        try {
          const event: EventEnvelope<any> = JSON.parse(message.value.toString());
          await this.handleEvent(topic, event);
        } catch (error) {
          logger.error({ error, topic }, 'Error processing notification event');
        }
      },
    });
  }

  private async handleEvent(topic: string, event: EventEnvelope<any>) {
    // 1. Idempotency Guard: Check if event was already processed
    const existing = await prisma.notificationLog.findUnique({
      where: { eventId: event.eventId }
    });

    if (existing) {
      logger.info({ eventId: event.eventId }, 'Duplicate event detected, skipping notification');
      return;
    }

    let content = '';
    let type: 'EMAIL' | 'SMS' = 'EMAIL';
    let recipient = `user_${event.payload.userId}@example.com`;

    switch (topic) {
      case DomainEvent.ORDER_CONFIRMED:
        content = `Your order #${event.payload.orderId} has been confirmed!`;
        break;
      case DomainEvent.PAYMENT_SUCCESS:
        content = `Payment received for order #${event.payload.orderId}. Total: ${event.payload.amount}`;
        break;
      case DomainEvent.TICKET_GENERATED:
        content = `Your tickets for order #${event.payload.orderId} are ready. View them in your profile.`;
        type = 'SMS';
        recipient = `+1234567890`;
        break;
      default:
        return;
    }

    // 2. Dispatch Mock Notification
    const channel = type === 'EMAIL' ? 'SMTP-MOCK' : 'TWILIO-MOCK';
    if (type === 'EMAIL') {
      await this.emailProvider.send(recipient, content, 'EventSphere Notification');
    } else {
      await this.smsProvider.send(recipient, content);
    }

    // 3. Track Metrics
    notificationsSentTotal.inc({ type, channel });

    // 4. Save to History
    await prisma.notificationLog.create({
      data: {
        userId: event.payload.userId,
        type,
        channel,
        recipient,
        content,
        eventId: event.eventId,
      }
    });
  }

  async shutdown() {
    await this.consumer.disconnect();
  }
}
