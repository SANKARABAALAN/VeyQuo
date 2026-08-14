import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrismaInstance = () => {
  // Force absolute path resolve to prisma/dev.db to ensure both migration
  // and runtime refer to the same SQLite file.
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });

  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? getPrismaInstance();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
