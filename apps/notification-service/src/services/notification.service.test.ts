import { NotificationService } from './notification.service';
import { prisma } from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  prisma: {
    notificationLog: {
      create: jest.fn().mockResolvedValue({ id: '1' })
    }
  }
}));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  it('should handle payment.success event', async () => {
    const event = {
      eventId: 'evt-1',
      payload: { userId: 1, orderId: 789, amount: 100 }
    };

    await (service as any).handleEvent('payment.success.v1', event);

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 1,
        content: expect.stringContaining('Payment received')
      })
    }));
  });
});
