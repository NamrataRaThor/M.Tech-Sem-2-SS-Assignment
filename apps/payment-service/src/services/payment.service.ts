import { PaymentRepository } from '../repositories/payment.repository';
import { logger } from '@eventsphere/common';
import { kafkaProducer } from '../events/producer';
import { DomainEvent } from '@eventsphere/contracts';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  private repository = new PaymentRepository();

  async processCharge(data: {
    orderId: number;
    amount: number;
    method: string;
    idempotencyKey: string;
    correlationId?: string;
  }) {
    logger.info({ orderId: data.orderId }, 'Processing payment charge');

    // 1. Double-Charge Guard: Check if order is already paid
    const existingPayments = await this.repository.findByOrderId(data.orderId);
    if (existingPayments.some(p => p.status === 'SUCCESS')) {
      logger.warn({ orderId: data.orderId }, 'Rejecting charge: Order already paid');
      throw new Error('Order has already been paid');
    }

    // 2. Create pending record
    const payment = await this.repository.create(data);

    try {
      // 3. Simulate Payment Gateway Call
      const gatewayResponse = await this.mockGatewayCharge(data.amount);
      
      const correlationId = data.correlationId || uuidv4();

      if (gatewayResponse.success) {
        // 4. Update to SUCCESS
        const updatedPayment = await this.repository.updateStatus(
          payment.id,
          'SUCCESS',
          gatewayResponse.transactionId
        );
        
        // 5. Emit Success Event
        await kafkaProducer.emit(DomainEvent.PAYMENT_SUCCESS, {
          eventId: uuidv4(),
          eventType: DomainEvent.PAYMENT_SUCCESS,
          timestamp: new Date().toISOString(),
          correlationId,
          payload: { 
            paymentId: updatedPayment.id, 
            orderId: updatedPayment.orderId, 
            amount: updatedPayment.amount 
          }
        });

        logger.info({ paymentId: payment.id }, 'Payment successful');
        return updatedPayment;
      } else {
        // 6. Update to FAILED
        await this.repository.updateStatus(payment.id, 'FAILED');
        
        // 7. Emit Failure Event
        await kafkaProducer.emit(DomainEvent.PAYMENT_FAILED, {
          eventId: uuidv4(),
          eventType: DomainEvent.PAYMENT_FAILED,
          timestamp: new Date().toISOString(),
          correlationId,
          payload: { orderId: data.orderId, reason: 'Declined by gateway' }
        });

        throw new Error('Payment declined by gateway');
      }
    } catch (error: any) {
      if (error.message !== 'Payment declined by gateway') {
        await this.repository.updateStatus(payment.id, 'FAILED');
      }
      logger.error({ error: error.message, paymentId: payment.id }, 'Payment processing failed');
      throw error;
    }
  }

  async processRefund(paymentId: number, reason: string) {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'SUCCESS') throw new Error('Only successful payments can be refunded');

    logger.info({ paymentId, reason }, 'Processing refund');
    
    // Simulate gateway refund
    return this.repository.updateStatus(paymentId, 'REFUNDED');
  }

  private async mockGatewayCharge(amount: number): Promise<{ success: boolean; transactionId?: string }> {
    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate success (95% rate)
    const success = Math.random() < 0.95;
    return {
      success,
      transactionId: success ? `TXN-${uuidv4().substring(0, 8).toUpperCase()}` : undefined
    };
  }
}
