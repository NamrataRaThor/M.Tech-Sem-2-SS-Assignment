export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  timestamp: string;
  correlationId: string;
  payload: T;
}

export enum DomainEvent {
  ORDER_CREATED = 'order.created.v1',
  ORDER_CONFIRMED = 'order.confirmed.v1',
  ORDER_FAILED = 'order.failed.v1',
  SEAT_RESERVED = 'seat.reserved.v1',
  SEAT_RELEASED = 'seat.released.v1',
  PAYMENT_SUCCESS = 'payment.success.v1',
  PAYMENT_FAILED = 'payment.failed.v1',
  TICKET_GENERATED = 'ticket.generated.v1',
}
