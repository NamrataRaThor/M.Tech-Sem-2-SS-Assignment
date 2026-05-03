// @ts-ignore
import { Payment, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class PaymentRepository {
  async create(data: {
    orderId: number;
    amount: number;
    method: string;
    transactionId: string;
    status: any;
    idempotencyKey: string;
  }): Promise<any> {
    // @ts-ignore
    return prisma.payment.create({
      data: {
        orderId: data.orderId,
        amount: data.amount,
        method: data.method,
        transactionId: data.transactionId,
        status: data.status,
        idempotencyKey: data.idempotencyKey,
      },
    });
  }

  async updateStatus(id: number, status: any): Promise<any> {
    // @ts-ignore
    return prisma.payment.update({
      where: { id },
      data: { status },
    });
  }

  async findByOrderId(orderId: number): Promise<any> {
    // @ts-ignore
    return prisma.payment.findMany({
      where: { orderId },
    });
  }
}
