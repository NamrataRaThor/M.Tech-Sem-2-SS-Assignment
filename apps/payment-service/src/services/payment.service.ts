import { PaymentRepository } from '../repositories/payment.repository';
import { logger } from '../common/index';
import { kafkaProducer } from '../events/producer';
import { DomainEvent } from '../types/events';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  private repository = new PaymentRepository();

  async processPayment(data: {
    orderId: number;
    amount: number;
    method: string;
    idempotencyKey: string;
  }, correlationId: string) {
    logger.info({ orderId: data.orderId, amount: data.amount }, 'Processing payment');

    // 1. Check for existing successful payment for this order
    const existingPayments = await this.repository.findByOrderId(data.orderId);
    // @ts-ignore
    if (existingPayments.some((p: any) => p.status === 'SUCCESS')) {
      logger.warn({ orderId: data.orderId }, 'Payment already exists for this order');
      return { success: true, message: 'Already paid' };
    }

    // 2. Mock Gateway Call
    const gatewayResponse = await this.mockGatewayCharge(data.amount, data.method);

    // 3. Persist Payment Record
    const payment = await this.repository.create({
      orderId: data.orderId,
      amount: data.amount,
      method: data.method,
      transactionId: gatewayResponse.transactionId,
      status: gatewayResponse.success ? 'SUCCESS' : 'FAILED',
      idempotencyKey: data.idempotencyKey // Pass the key
    });

    // 4. Emit Events & Return
    if (gatewayResponse.success) {
      await kafkaProducer.emit(DomainEvent.PAYMENT_SUCCESS, {
        eventId: uuidv4(),
        eventType: DomainEvent.PAYMENT_SUCCESS,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
        },
        payload: { orderId: data.orderId, paymentId: payment.id, amount: data.amount }
      });

      return { success: true, transactionId: gatewayResponse.transactionId };
    } else {
      await kafkaProducer.emit(DomainEvent.PAYMENT_FAILED, {
        eventId: uuidv4(),
        eventType: DomainEvent.PAYMENT_FAILED,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
        },
        payload: { orderId: data.orderId, reason: 'Gateway declined' }
      });

      throw new Error('Payment declined by gateway');
    }
  }

  private async mockGatewayCharge(amount: number, method: string) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Always succeed for testing (can be Math.random() < 0.9 later)
    const success = true; 
    return {
      success,
      transactionId: `tx-${uuidv4().substring(0, 8)}`,
    };
  }

  async getPaymentStatus(orderId: number) {
    const payments = await this.repository.findByOrderId(orderId);
    return payments[0] || null;
  }
}
