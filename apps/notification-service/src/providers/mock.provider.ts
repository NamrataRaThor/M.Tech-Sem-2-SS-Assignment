import { logger } from '../common/index';

export interface NotificationProvider {
  send(recipient: string, content: string, subject?: string): Promise<boolean>;
}

export class MockEmailProvider implements NotificationProvider {
  async send(recipient: string, content: string, subject?: string): Promise<boolean> {
    logger.info({
      type: 'EMAIL',
      to: recipient,
      subject,
      content: content.substring(0, 50) + '...'
    }, 'MOCK EMAIL SENT');
    return true;
  }
}

export class MockSMSProvider implements NotificationProvider {
  async send(recipient: string, content: string): Promise<boolean> {
    logger.info({
      type: 'SMS',
      to: recipient,
      content: content.substring(0, 50) + '...'
    }, 'MOCK SMS SENT');
    return true;
  }
}
