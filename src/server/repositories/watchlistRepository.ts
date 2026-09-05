import { prisma } from "@/lib/prisma";

export interface WatchlistItemDTO {
  id: string;
  symbol: string;
  addedAt: Date;
}

export const watchlistRepository = {
  async list(userId: string): Promise<WatchlistItemDTO[]> {
    return prisma.watchlistItem.findMany({ where: { userId }, orderBy: { addedAt: "asc" } });
  },

  async add(userId: string, symbol: string): Promise<WatchlistItemDTO> {
    return prisma.watchlistItem.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol },
      update: {},
    });
  },

  async remove(userId: string, symbol: string): Promise<void> {
    await prisma.watchlistItem.deleteMany({ where: { userId, symbol } });
  },
};
