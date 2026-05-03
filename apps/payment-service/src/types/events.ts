export enum DomainEvent {
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed'
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
