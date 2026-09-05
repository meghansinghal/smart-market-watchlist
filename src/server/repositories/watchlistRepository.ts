import { prisma } from "@/lib/prisma";

export interface WatchlistItemDTO {
  id: string;
  symbol: string;
  addedAt: Date;
}

export const watchlistRepository = {
  async list(): Promise<WatchlistItemDTO[]> {
    return prisma.watchlistItem.findMany({ orderBy: { addedAt: "asc" } });
  },

  async add(symbol: string): Promise<WatchlistItemDTO> {
    return prisma.watchlistItem.upsert({
      where: { symbol },
      create: { symbol },
      update: {},
    });
  },

  async remove(symbol: string): Promise<void> {
    await prisma.watchlistItem.deleteMany({ where: { symbol } });
  },

  async exists(symbol: string): Promise<boolean> {
    const row = await prisma.watchlistItem.findUnique({ where: { symbol } });
    return row !== null;
  },
};
