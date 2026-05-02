import { TicketService } from './ticket.service';
import { TicketRepository } from '../repositories/ticket.repository';

jest.mock('../repositories/ticket.repository');
jest.mock('../index', () => ({
  ticketsGeneratedTotal: { inc: jest.fn() }
}));

describe('TicketService', () => {
  let ticketService: TicketService;
  let mockRepo: jest.Mocked<TicketRepository>;

  beforeEach(() => {
    mockRepo = new TicketRepository() as jest.Mocked<TicketRepository>;
    ticketService = new TicketService();
    (ticketService as any).repository = mockRepo;
  });

  it('should generate tickets for a confirmed order', async () => {
    const payload = {
      orderId: 789,
      userId: 1,
      eventId: 101,
      seats: [10, 11]
    };

    await (ticketService as any).generateTicketsForOrder(payload);

    expect(mockRepo.createMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ orderId: 789, seatId: 10 }),
      expect.objectContaining({ orderId: 789, seatId: 11 })
    ]));
  });
});
