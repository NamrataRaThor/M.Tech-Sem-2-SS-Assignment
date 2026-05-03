import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '../../../dataset/ticketing_seats.csv');
  const results: any[] = [];

  console.log('Seeding seats from:', filePath);

  if (!fs.existsSync(filePath)) {
    console.warn('Dataset file not found, skipping seed.');
    return;
  }

  // Use a transaction for bulk insert to speed up seeding of ~7000 seats
  const BATCH_SIZE = 500;
  let batch: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => batch.push(data))
    .on('end', async () => {
      console.log(`Processing ${batch.length} seats...`);
      
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const currentBatch = batch.slice(i, i + BATCH_SIZE);
        // @ts-ignore
    // @ts-ignore
    await prisma.seat.createMany({
          data: currentBatch.map(row => ({
            id: parseInt(row.seat_id),
            eventId: parseInt(row.event_id),
            label: row.seat_label,
            section: row.section,
            price: parseFloat(row.seat_price),
            status: row.seat_status as any,
            createdAt: new Date(row.created_at),
          })),
          skipDuplicates: true,
        });
        console.log(`Seeded batch ${i / BATCH_SIZE + 1}`);
      }
      
      console.log('Seeding completed.');
      // @ts-ignore
    // @ts-ignore
    await prisma.$disconnect();
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
