import axios from 'axios';

const SEATING_SERVICE_URL = process.env.SEATING_SERVICE_URL || 'http://seating-service:8083';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:8084';

export const seatingClient = {
  reserve: async (eventId: number, seatIds: number[], correlationId: string) => {
    const response = await axios.post(`${SEATING_SERVICE_URL}/api/v1/seats/reserve`, {
      eventId,
      seatIds,
      orderId: 0 // Placeholder
    }, { headers: { 'x-correlation-id': correlationId } });
    return response.data;
  },
  release: async (seatIds: number[], correlationId: string) => {
    const response = await axios.post(`${SEATING_SERVICE_URL}/api/v1/seats/release`, {
      seatIds
    }, { headers: { 'x-correlation-id': correlationId } });
    return response.data;
  }
};

export const paymentClient = {
  charge: async (data: { orderId: number; amount: number; method: string; idempotencyKey: string }, correlationId: string) => {
    const response = await axios.post(`${PAYMENT_SERVICE_URL}/api/v1/payments/charge`, data, {
      headers: {
        'idempotency-key': data.idempotencyKey,
        'x-correlation-id': correlationId
      }
    });
    return response.data;
  }
};
