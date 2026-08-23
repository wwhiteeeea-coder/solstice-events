import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.printJob.deleteMany();
  await prisma.attendee.deleteMany();

  // Create test attendees
  const attendees = await Promise.all([
    prisma.attendee.create({
      data: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '+1-555-0001',
        qrCode: 'QR001'
      }
    }),
    prisma.attendee.create({
      data: {
        name: 'Brian Otieno',
        email: 'brian@example.com',
        phone: '+1-555-0002',
        qrCode: 'QR002'
      }
    }),
    prisma.attendee.create({
      data: {
        name: 'Carol Wanjiku',
        email: 'carol@example.com',
        phone: '+1-555-0003',
        qrCode: 'QR003'
      }
    })
  ]);

  // Add more attendees to reach 500
  const moreAttendees = [];
  for (let i = 4; i <= 500; i++) {
    moreAttendees.push({
      name: `Attendee ${i}`,
      email: `attendee${i}@example.com`,
      phone: `+1-555-${String(i).padStart(4, '0')}`,
      qrCode: `QR${String(i).padStart(3, '0')}`
    });
  }

  await prisma.attendee.createMany({
    data: moreAttendees
  });

  console.log(`✓ Created ${attendees.length + moreAttendees.length} attendees`);
  console.log('✓ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
