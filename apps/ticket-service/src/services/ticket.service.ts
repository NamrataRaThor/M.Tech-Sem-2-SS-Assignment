import { Kafka, Consumer } from 'kafkajs';
import { TicketRepository } from '../repositories/ticket.repository';
import { DomainEvent, EventEnvelope } from '../types/events';
import { kafkaProducer } from '../events/producer';
import { logger } from '../common/index';
import { v4 as uuidv4 } from 'uuid';

export class TicketService {
  private kafka: Kafka;
  private consumer: Consumer;
  private repository = new TicketRepository();

  constructor() {
    this.kafka = new Kafka({
      clientId: 'ticket-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    });
    this.consumer = this.kafka.consumer({ groupId: 'ticket-group' });
  }

  async startListening() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: DomainEvent.ORDER_CONFIRMED, fromBeginning: true });

    logger.info('Ticket Service listening for order.confirmed events...');

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        
        try {
          const event: EventEnvelope<any> = JSON.parse(message.value.toString());
          await this.generateTickets(event);
        } catch (error) {
          logger.error({ error }, 'Error processing ticket generation');
        }
      },
    });
  }

  private async generateTickets(event: EventEnvelope<any>) {
    const { orderId, userId, seats } = event.payload;
    
    logger.info({ orderId, seatCount: seats.length }, 'Generating tickets for order');

    for (const seatId of seats) {
      const ticketCode = `TCK-${uuidv4().substring(0, 8).toUpperCase()}`;
      
      await this.repository.create({
        orderId,
        userId,
        seatId,
        ticketCode,
        status: 'VALID'
      });
    }

    // Emit Ticket Generated Event
    await kafkaProducer.emit(DomainEvent.TICKET_GENERATED, {
      eventId: uuidv4(),
      eventType: DomainEvent.TICKET_GENERATED,
      metadata: {
        correlationId: event.metadata.correlationId,
        timestamp: new Date().toISOString(),
      },
      payload: { orderId, userId, ticketCount: seats.length }
    });

    logger.info({ orderId }, 'Tickets generated successfully');
  }

  async shutdown() {
    await this.consumer.disconnect();
  }
}
