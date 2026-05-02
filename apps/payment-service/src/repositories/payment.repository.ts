import { Payment, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class PaymentRepository {
  async create(data: {
    orderId: number;
    amount: number;
    idempotencyKey: string;
    method: string;
  }): Promise<Payment> {
    return prisma.payment.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });
  }

  async updateStatus(id: number, status: PaymentStatus, transactionId?: string): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data: { status, transactionId },
    });
  }

  async findById(id: number): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { id },
    });
  }

  async findByOrderId(orderId: number): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { orderId },
    });
  }
}
