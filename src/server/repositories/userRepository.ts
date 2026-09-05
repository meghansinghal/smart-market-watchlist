import { prisma } from "@/lib/prisma";

export interface UserDTO {
  id: string;
  name: string;
}

export const userRepository = {
  async list(): Promise<UserDTO[]> {
    return prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  },

  async exists(id: string): Promise<boolean> {
    const row = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    return row !== null;
  },
};
