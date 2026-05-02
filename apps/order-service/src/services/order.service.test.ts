import { OrderService } from './order.service';
import { OrderRepository } from '../repositories/order.repository';
import { seatingClient, paymentClient } from '../clients';
import { kafkaProducer } from '../events/producer';

jest.mock('../repositories/order.repository');
jest.mock('../clients');
jest.mock('../events/producer', () => ({
  kafkaProducer: {
    emit: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('OrderService Saga', () => {
  let orderService: OrderService;
  let mockRepository: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    mockRepository = new OrderRepository() as jest.Mocked<OrderRepository>;
    orderService = new OrderService();
    (orderService as any).repository = mockRepository;
    jest.clearAllMocks();
  });

  it('should successfully complete the order saga', async () => {
    // 1. Mock Seating Reservation
    (seatingClient.reserve as jest.Mock).mockResolvedValue({
      success: true,
      data: { seats: [{ id: 1, price: 100 }, { id: 2, price: 200 }] }
    });

    // 2. Mock Order Creation
    const mockOrder = { id: 789, userId: 1, total: 315, status: 'PENDING', items: [] } as any;
    mockRepository.create.mockResolvedValue(mockOrder);

    // 3. Mock Payment Success
    (paymentClient.charge as jest.Mock).mockResolvedValue({ success: true });
    
    // 4. Mock Final Confirmation
    mockRepository.updateStatus.mockResolvedValue({ ...mockOrder, status: 'CONFIRMED', items: [{ seatId: 1 }, { seatId: 2 }] });

    const result = await orderService.placeOrder({
      userId: 1,
      eventId: 101,
      seatIds: [1, 2],
      paymentMethod: 'UPI'
    }, 'trace-123');

    expect(result.status).toBe('CONFIRMED');
    expect(seatingClient.reserve).toHaveBeenCalled();
    expect(paymentClient.charge).toHaveBeenCalled();
    expect(kafkaProducer.emit).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      eventType: 'order.confirmed.v1'
    }));
  });

  it('should rollback and release seats if payment fails', async () => {
    // 1. Mock Seating Reservation
    (seatingClient.reserve as jest.Mock).mockResolvedValue({
      success: true,
      data: { seats: [{ id: 1, price: 100 }] }
    });

    // 2. Mock Order Creation
    const mockOrder = { id: 789, userId: 1, total: 105, status: 'PENDING' } as any;
    mockRepository.create.mockResolvedValue(mockOrder);

    // 3. Mock Payment Failure
    (paymentClient.charge as jest.Mock).mockResolvedValue({ success: false });
    (seatingClient.release as jest.Mock).mockResolvedValue({ success: true });

    await expect(orderService.placeOrder({
      userId: 1,
      eventId: 101,
      seatIds: [1],
      paymentMethod: 'UPI'
    }, 'trace-123')).rejects.toThrow('Payment failed');

    expect(mockRepository.updateStatus).toHaveBeenCalledWith(789, 'FAILED');
    expect(seatingClient.release).toHaveBeenCalledWith([1], 'trace-123');
    expect(kafkaProducer.emit).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      eventType: 'order.failed.v1'
    }));
  });
});
