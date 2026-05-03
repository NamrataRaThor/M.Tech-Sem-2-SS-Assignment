export enum DomainEvent {
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_FAILED = 'order.failed',
  PAYMENT_SUCCESS = 'payment.success',
  TICKET_GENERATED = 'ticket.generated'
}

export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  payload: T;
  metadata: {
    correlationId: string;
    timestamp: string;
  };
}
