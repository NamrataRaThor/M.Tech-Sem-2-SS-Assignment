import { PaymentService } from './payment.service';
import { PaymentRepository } from '../repositories/payment.repository';

jest.mock('../repositories/payment.repository');
jest.mock('../events/producer', () => ({
  kafkaProducer: {
    emit: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockRepository: jest.Mocked<PaymentRepository>;

  beforeEach(() => {
    mockRepository = new PaymentRepository() as jest.Mocked<PaymentRepository>;
    paymentService = new PaymentService();
    (paymentService as any).repository = mockRepository;
  });

  it('should process a successful charge', async () => {
    const mockPayment = { id: 1, orderId: 101, amount: 100, status: 'PENDING', idempotencyKey: 'key1' } as any;
    mockRepository.create.mockResolvedValue(mockPayment);
    mockRepository.updateStatus.mockResolvedValue({ ...mockPayment, status: 'SUCCESS', transactionId: 'TXN123' });
    
    // Force mockGateway to succeed
    (paymentService as any).mockGatewayCharge = jest.fn().mockResolvedValue({ success: true, transactionId: 'TXN123' });

    const result = await paymentService.processCharge({
      orderId: 101,
      amount: 100,
      method: 'UPI',
      idempotencyKey: 'key1'
    });

    expect(result.status).toBe('SUCCESS');
    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(1, 'SUCCESS', 'TXN123');
  });

  it('should handle a failed charge', async () => {
    const mockPayment = { id: 1, orderId: 101, amount: 100, status: 'PENDING' } as any;
    mockRepository.create.mockResolvedValue(mockPayment);
    
    (paymentService as any).mockGatewayCharge = jest.fn().mockResolvedValue({ success: false });

    await expect(paymentService.processCharge({
      orderId: 101,
      amount: 100,
      method: 'UPI',
      idempotencyKey: 'key1'
    })).rejects.toThrow('Payment declined by gateway');

    expect(mockRepository.updateStatus).toHaveBeenCalledWith(1, 'FAILED');
  });
});
