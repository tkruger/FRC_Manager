-- AlterEnum (on its own: a new value can't be used in the transaction that adds it)
ALTER TYPE "ItemCategory" ADD VALUE 'UNCATEGORIZED' BEFORE 'MECHANICAL';
