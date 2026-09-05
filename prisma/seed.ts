import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_WATCHLIST = ["INFY.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "RELIANCE.NS"];

async function main() {
  for (const symbol of DEFAULT_WATCHLIST) {
    await prisma.watchlistItem.upsert({ where: { symbol }, create: { symbol }, update: {} });
  }
  console.log(`Seeded watchlist: ${DEFAULT_WATCHLIST.join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
