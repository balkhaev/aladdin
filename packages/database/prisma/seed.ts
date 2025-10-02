import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create test user if not exists
  const testUserId = "test-user";
  const existingUser = await prisma.user.findUnique({
    where: { id: testUserId },
  });

  if (existingUser) {
    console.log("✅ Test user already exists");
  } else {
    console.log("Creating test user...");
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("✅ Test user created");
  }

  console.log("🌱 Database seed completed!");
}

main()
  .catch((error) => {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
