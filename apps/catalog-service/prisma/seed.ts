import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

async function seedVenues() {
  const filePath = path.join(__dirname, '../../../dataset/ticketing_venues.csv');
  const results: any[] = [];
  console.log('Seeding venues from:', filePath);

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve(null);
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          await prisma.venue.upsert({
            where: { id: parseInt(row.venue_id) },
            update: {},
            create: {
              id: parseInt(row.venue_id),
              name: row.name,
              city: row.city,
              area: row.area,
              capacity: parseInt(row.capacity),
              type: row.venue_type,
              createdAt: new Date(row.created_at),
            },
          });
        }
        console.log(`Seeded ${results.length} venues.`);
        resolve(null);
      })
      .on('error', reject);
  });
}

async function seedEvents() {
  const filePath = path.join(__dirname, '../../../dataset/ticketing_events.csv');
  const results: any[] = [];
  console.log('Seeding events from:', filePath);

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve(null);
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          await prisma.event.upsert({
            where: { id: parseInt(row.event_id) },
            update: {},
            create: {
              id: parseInt(row.event_id),
              venueId: parseInt(row.venue_id),
              title: row.title,
              type: row.event_type,
              city: row.city,
              status: row.status as any,
              startTime: new Date(row.start_time),
              endTime: new Date(row.end_time),
              basePrice: parseFloat(row.base_price),
              createdAt: new Date(row.created_at),
            },
          });
        }
        console.log(`Seeded ${results.length} events.`);
        resolve(null);
      })
      .on('error', reject);
  });
}

async function main() {
  await seedVenues();
  await seedEvents();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
