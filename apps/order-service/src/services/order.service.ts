import { OrderRepository } from '../repositories/order.repository';
import { calculateTax, calculateTotal } from '../calculations/tax';
import { seatingClient, paymentClient } from '../clients';
import { kafkaProducer } from '../events/producer';
import { DomainEvent } from '@eventsphere/contracts';
import { sagaRollbacksTotal, sagaDuration } from '../index';
import { logger } from '@eventsphere/common';
import { v4 as uuidv4 } from 'uuid';

export class OrderService {
  private repository = new OrderRepository();

  async placeOrder(data: {
    userId: number;
    eventId: number;
    seatIds: number[];
    paymentMethod: string;
  }, correlationId: string) {
    const endTimer = sagaDuration.startTimer();
    logger.info({ userId: data.userId, eventId: data.eventId }, 'Starting order placement saga');

    try {
      // 1. Reserve Seats & Get Authoritative Pricing
      const reservation = await seatingClient.reserve(data.eventId, data.seatIds, correlationId);

      if (!reservation.success) {
        throw new Error('Failed to reserve seats');
      }

      const reservedSeats = reservation.data.seats;
      const subtotal = reservedSeats.reduce((sum: number, seat: any) => sum + seat.price, 0);
      const tax = calculateTax(subtotal);
      const total = calculateTotal(subtotal, tax);

      // 2. Create Pending Order
      const order = await this.repository.create({
        userId: data.userId,
        eventId: data.eventId,
        subtotal,
        tax,
        total,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        items: reservedSeats.map((s: any) => ({ seatId: s.id, price: s.price })),
      });

      try {
        // 3. Invoke Payment Service (Idempotent)
        const payment = await paymentClient.charge({
          orderId: order.id,
          amount: total,
          method: data.paymentMethod,
          idempotencyKey: `order-${order.id}`,
        }, correlationId);

        if (payment.success) {
          // 4. Confirm Order
          const confirmedOrder = await this.repository.updateStatus(order.id, 'CONFIRMED');
          logger.info({ orderId: order.id }, 'Order confirmed successfully');
          
          // 5. Emit Confirmed Event
          await kafkaProducer.emit(DomainEvent.ORDER_CONFIRMED, {
            eventId: uuidv4(),
            eventType: DomainEvent.ORDER_CONFIRMED,
            timestamp: new Date().toISOString(),
            correlationId,
            payload: { 
              orderId: confirmedOrder.id, 
              userId: confirmedOrder.userId,
              seats: confirmedOrder.items.map(i => i.seatId)
            }
          });
          
          endTimer();
          return confirmedOrder;
        } else {
          throw new Error('Payment failed');
        }
      } catch (error: any) {
        logger.error({ error: error.message, orderId: order.id }, 'Order saga failed at payment step');
        sagaRollbacksTotal.inc({ reason: error.message });
        
        await this.repository.updateStatus(order.id, 'FAILED');
        
        // Emit Failure Event
        kafkaProducer.emit(DomainEvent.ORDER_FAILED, {
          eventId: uuidv4(),
          eventType: DomainEvent.ORDER_FAILED,
          timestamp: new Date().toISOString(),
          correlationId,
          payload: { orderId: order.id, reason: error.message }
        }).catch(err => logger.error({ err }, 'Failed to emit failure event'));

        // Rollback: Detached Release Seats
        seatingClient.release(data.seatIds, correlationId).catch(err => 
          logger.error({ err }, 'CRITICAL: Compensation failed (Manual intervention required)')
        );
        
        endTimer();
        throw error;
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Order placement failed');
      endTimer();
      throw error;
    }
  }

  async cancelOrder(orderId: number, correlationId: string) {
    const order = await this.repository.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'PENDING') throw new Error('Only pending orders can be cancelled');

    await this.repository.updateStatus(orderId, 'CANCELLED');
    
    // Release Seats
    await seatingClient.release(order.items.map(i => i.seatId), correlationId);

    logger.info({ orderId }, 'Order cancelled and seats released');
    return { success: true };
  }
}
