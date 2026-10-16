-- AlterTable
ALTER TABLE "PurchaseLineItem" ADD COLUMN     "budgetCategory" "BudgetCategoryType";

-- AlterTable
ALTER TABLE "OrderDraft" ADD COLUMN     "budgetCategory" "BudgetCategoryType";

