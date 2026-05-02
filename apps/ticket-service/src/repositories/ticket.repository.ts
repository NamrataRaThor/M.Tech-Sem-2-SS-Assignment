import { Ticket, TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class TicketRepository {
  async createMany(data: {
    orderId: number;
    userId: number;
    eventId: number;
    seatId: number;
    ticketNumber: string;
    qrCode: string;
  }[]) {
    return prisma.ticket.createMany({
      data,
      skipDuplicates: true
    });
  }

  async findById(id: string): Promise<Ticket | null> {
    return prisma.ticket.findUnique({
      where: { id }
    });
  }

  async findByOrderId(orderId: number): Promise<Ticket[]> {
    return prisma.ticket.findMany({
      where: { orderId }
    });
  }

  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return prisma.ticket.update({
      where: { id },
      data: { status }
    });
  }
}
