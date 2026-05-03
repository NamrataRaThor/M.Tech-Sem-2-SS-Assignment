import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '../../../dataset/ticketing_users.csv');
  const results: any[] = [];
  const passwordHash = await bcrypt.hash('password123', 12);

  console.log('Seeding users from:', filePath);

  if (!fs.existsSync(filePath)) {
    console.warn('Dataset file not found, skipping seed.');
    return;
  }

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (const row of results) {
        // @ts-ignore
    // @ts-ignore
    await prisma.user.upsert({
          where: { email: row.email },
          update: {},
          create: {
            id: parseInt(row.user_id),
            name: row.name,
            email: row.email,
            phone: row.phone,
            city: row.city,
            passwordHash: passwordHash,
            createdAt: new Date(row.created_at),
          },
        });
      }
      console.log(`Seeded ${results.length} users.`);
      // @ts-ignore
    // @ts-ignore
    await prisma.$disconnect();
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
