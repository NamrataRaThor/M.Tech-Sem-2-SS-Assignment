import { Kafka, Producer } from 'kafkajs';
import { logger } from '../common/index';
import { EventEnvelope, DomainEvent } from '../types/events';

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'payment-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    });
    this.producer = this.kafka.producer();
  }

  async connect() {
    try {
      await this.producer.connect();
      logger.info('Kafka Producer connected');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka Producer');
    }
  }

  async emit<T>(topic: DomainEvent, event: EventEnvelope<T>) {
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(event) }],
      });
      logger.info({ topic, eventId: event.eventId }, 'Event emitted to Kafka');
    } catch (error) {
      logger.error({ error, topic }, 'Failed to emit event to Kafka');
    }
  }

  async disconnect() {
    await this.producer.disconnect();
  }
}

export const kafkaProducer = new KafkaProducer();
