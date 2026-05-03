// @ts-ignore
import { Ticket, TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class TicketRepository {
  async create(data: {
    orderId: number;
    userId: number;
    seatId: number;
    ticketCode: string;
    status: any;
  }): Promise<any> {
    // @ts-ignore
    return prisma.ticket.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        seatId: data.seatId,
        ticketCode: data.ticketCode,
        status: data.status,
      },
    });
  }

  async findByOrderId(orderId: number): Promise<any> {
    // @ts-ignore
    return prisma.ticket.findMany({
      where: { orderId },
    });
  }

  async findById(id: string): Promise<any> {
    // @ts-ignore
    return prisma.ticket.findUnique({
      where: { id: parseInt(id) },
    });
  }
}
