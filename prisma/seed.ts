import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Two demo users with deliberately overlapping-but-different watchlists
// (both track TCS.NS) so it's easy to see, side by side, that each user's
// watchlist and checkpoint state is fully independent while they're both
// looking at the same shared market data.
const DEMO_USERS: { name: string; watchlist: string[] }[] = [
  { name: "Alice", watchlist: ["INFY.NS", "TCS.NS", "RELIANCE.NS"] },
  { name: "Bob", watchlist: ["HDFCBANK.NS", "ICICIBANK.NS", "TCS.NS"] },
];

async function main() {
  for (const { name, watchlist } of DEMO_USERS) {
    const user = await prisma.user.upsert({ where: { name }, create: { name }, update: {} });
    for (const symbol of watchlist) {
      await prisma.watchlistItem.upsert({
        where: { userId_symbol: { userId: user.id, symbol } },
        create: { userId: user.id, symbol },
        update: {},
      });
    }
    console.log(`Seeded ${name} (${user.id}) watchlist: ${watchlist.join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
