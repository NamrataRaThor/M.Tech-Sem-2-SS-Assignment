import { v4 as uuidv4 } from 'uuid';

export const generateTicketNumber = (eventId: number): string => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EVT-${eventId}-${random}`;
};

export const generateMockQRCode = (ticketNumber: string): string => {
  // In a real app, this would return a base64 image or a signed JWT
  return Buffer.from(`eventsphere://validate/${ticketNumber}`).toString('base64');
};
