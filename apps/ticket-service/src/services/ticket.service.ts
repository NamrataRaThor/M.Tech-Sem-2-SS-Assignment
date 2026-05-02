import { TicketRepository } from '../repositories/ticket.repository';
import { generateTicketNumber, generateMockQRCode } from '../utils/generators';
import { logger } from '@eventsphere/common';
import { ticketsGeneratedTotal } from '../index';
import { Kafka, Consumer } from 'kafkajs';
import { DomainEvent, EventEnvelope } from '@eventsphere/contracts';

export class TicketService {
  private repository = new TicketRepository();
  private kafka: Kafka;
  private consumer: Consumer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'ticket-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    this.consumer = this.kafka.consumer({ groupId: 'ticket-generation-group' });
  }

  async startListening() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: DomainEvent.ORDER_CONFIRMED, fromBeginning: true });

    logger.info('Ticket Service listening for confirmed orders...');

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        
        try {
          const event: EventEnvelope<any> = JSON.parse(message.value.toString());
          await this.generateTicketsForOrder(event.payload);
        } catch (error) {
          logger.error({ error }, 'Error processing order.confirmed event');
        }
      },
    });
  }

  private async generateTicketsForOrder(payload: { orderId: number; userId: number; eventId: number; seats: number[] }) {
    logger.info({ orderId: payload.orderId }, 'Generating tickets for order');

    const ticketsData = payload.seats.map(seatId => {
      const ticketNumber = generateTicketNumber(payload.eventId);
      return {
        orderId: payload.orderId,
        userId: payload.userId,
        eventId: payload.eventId,
        seatId: seatId,
        ticketNumber: ticketNumber,
        qrCode: generateMockQRCode(ticketNumber),
        status: 'VALID' as const
      };
    });

await this.repository.createMany(ticketsData);
    ticketsGeneratedTotal.inc({ eventId: payload.eventId.toString() }, ticketsData.length);
    logger.info({ orderId: payload.orderId, count: ticketsData.length }, 'Tickets generated successfully');
  }

  async shutdown() {
    await this.consumer.disconnect();
  }
}
