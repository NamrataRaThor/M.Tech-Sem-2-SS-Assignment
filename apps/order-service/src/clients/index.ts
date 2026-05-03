import axios from 'axios';

const getSeatingUrl = () => process.env.SEATING_SERVICE_URL || 'http://localhost:8083';
const getPaymentUrl = () => process.env.PAYMENT_SERVICE_URL || 'http://localhost:8084';

export const seatingClient = {
  reserve: async (eventId: number, seatIds: number[], correlationId: string) => {
    const baseUrl = getSeatingUrl();
    const url = `${baseUrl}/api/v1/seats/reserve`;
    console.log(`[OrderService] Calling Seating Service: ${url} with seats: ${seatIds}`);
    
    try {
      const response = await axios.post(url, {
        eventId,
        seatIds,
        orderId: 0
      }, { headers: { 'x-correlation-id': correlationId } });
      return response.data;
    } catch (error: any) {
      console.error(`[OrderService] Seating Service FAILED: ${url}. Status: ${error.response?.status}, Error: ${error.message}`);
      throw error;
    }
  },
  release: async (seatIds: number[], correlationId: string) => {
    const url = `${getSeatingUrl()}/api/v1/seats/release`;
    const response = await axios.post(url, {
      seatIds
    }, { headers: { 'x-correlation-id': correlationId } });
    return response.data;
  }
};

export const paymentClient = {
  charge: async (data: { orderId: number; amount: number; method: string; idempotencyKey: string }, correlationId: string) => {
    const url = `${getPaymentUrl()}/api/v1/payments/charge`;
    const response = await axios.post(url, data, {
      headers: {
        'idempotency-key': data.idempotencyKey,
        'x-correlation-id': correlationId
      }
    });
    return response.data;
  }
};
