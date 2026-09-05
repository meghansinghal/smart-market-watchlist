import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Five demo users with deliberately overlapping watchlists — every symbol
// is tracked by 3 of the 5 users, and every user tracks 3 of the 5 known
// symbols — so it's easy to show, side by side, that each user's
// watchlist and checkpoint state is fully independent while they're all
// looking at the same shared market data.
const DEMO_USERS: { name: string; watchlist: string[] }[] = [
  { name: "Meghan", watchlist: ["INFY.NS", "TCS.NS", "RELIANCE.NS"] },
  { name: "Siya", watchlist: ["HDFCBANK.NS", "ICICIBANK.NS", "TCS.NS"] },
  { name: "Karan", watchlist: ["INFY.NS", "HDFCBANK.NS", "RELIANCE.NS"] },
  { name: "Aditi", watchlist: ["TCS.NS", "ICICIBANK.NS", "INFY.NS"] },
  { name: "Arush", watchlist: ["HDFCBANK.NS", "RELIANCE.NS", "ICICIBANK.NS"] },
];

async function main() {
  // Keep the seed idempotent and clean: remove any previously-seeded demo
  // user not in the current roster (e.g. re-running this after renaming
  // the demo users), rather than leaving stale entries in the switcher.
  const currentNames = DEMO_USERS.map((u) => u.name);
  const removed = await prisma.user.deleteMany({ where: { name: { notIn: currentNames } } });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} demo user(s) no longer in the seed roster`);
  }

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
