import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed must not run in production.");
  }

  await prisma.event.upsert({
    where: { slug: "healthhack-2027" },
    update: {},
    create: {
      slug: "healthhack-2027",
      name: "HealthHack 2027",
      timezone: "Asia/Kolkata",
      settings: {
        create: [
          { key: "team.minSize", value: 1 },
          { key: "team.maxSize", value: 4 },
          { key: "features.teamFinder", value: true }
        ]
      }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
