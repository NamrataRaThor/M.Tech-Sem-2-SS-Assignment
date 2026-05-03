// @ts-ignore
import { Payment, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class PaymentRepository {
  async create(data: {
    orderId: number;
    amount: Float32Array | number;
    method: string;
    transactionId: string;
    status: any;
  }): Promise<any> {
    // @ts-ignore
    return prisma.payment.create({
      data: {
        orderId: data.orderId,
        amount: data.amount as any,
        method: data.method,
        transactionId: data.transactionId,
        status: data.status,
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
