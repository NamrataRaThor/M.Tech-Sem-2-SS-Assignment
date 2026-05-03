// @ts-ignore
// @ts-ignore
import { Order, OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class OrderRepository {
  async create(data: {
    userId: number;
    eventId: number;
    subtotal: number;
    tax: number;
    total: number;
    expiresAt: Date;
    items: { seatId: number; price: number }[];
  }): Promise<any> {
    // @ts-ignore
    return prisma.order.create({
      data: {
        userId: data.userId,
        eventId: data.eventId,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        expiresAt: data.expiresAt,
        items: {
          create: data.items,
        },
      },
      include: { items: true },
    });
  }

  async updateStatus(id: number, status: any): Promise<any> {
    // @ts-ignore
    return prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }

  async findById(id: number): Promise<any> {
    // @ts-ignore
    return prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  }
}
