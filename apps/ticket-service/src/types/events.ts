export enum DomainEvent {
  ORDER_CONFIRMED = 'order.confirmed',
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
