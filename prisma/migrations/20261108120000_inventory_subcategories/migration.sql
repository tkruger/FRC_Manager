-- AlterTable
ALTER TABLE "BaseInventoryItem" ADD COLUMN     "subcategoryId" TEXT;

-- CreateTable
CREATE TABLE "InventorySubcategory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventorySubcategory_teamId_category_name_key" ON "InventorySubcategory"("teamId", "category", "name");

-- AddForeignKey
ALTER TABLE "InventorySubcategory" ADD CONSTRAINT "InventorySubcategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseInventoryItem" ADD CONSTRAINT "BaseInventoryItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "InventorySubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Every team starts with the suggested sub-categories
INSERT INTO "InventorySubcategory" ("id", "teamId", "category", "name")
SELECT gen_random_uuid()::text, t."id", s.category::"ItemCategory", s.name
FROM "Team" t
CROSS JOIN (VALUES
  ('MECHANICAL', 'Gears'),
  ('MECHANICAL', 'Belts'),
  ('MECHANICAL', 'Pulleys'),
  ('MECHANICAL', 'Sprockets'),
  ('MECHANICAL', 'Chain'),
  ('MECHANICAL', 'Bearings'),
  ('MECHANICAL', 'Shafts'),
  ('MECHANICAL', 'Hubs'),
  ('MECHANICAL', 'Spacers & collars'),
  ('MECHANICAL', 'Wheels'),
  ('ELECTRICAL', 'Motors'),
  ('ELECTRICAL', 'Motor controllers'),
  ('ELECTRICAL', 'Wire'),
  ('ELECTRICAL', 'Connectors'),
  ('ELECTRICAL', 'Breakers & fuses'),
  ('ELECTRICAL', 'Batteries'),
  ('ELECTRONICS', 'Controllers & radios'),
  ('ELECTRONICS', 'Cables'),
  ('ELECTRONICS', 'Circuit boards'),
  ('SENSORS', 'Encoders'),
  ('SENSORS', 'Limit switches'),
  ('SENSORS', 'Cameras'),
  ('SENSORS', 'Gyros & IMUs'),
  ('SENSORS', 'Distance sensors'),
  ('PNEUMATICS', 'Cylinders'),
  ('PNEUMATICS', 'Valves'),
  ('PNEUMATICS', 'Tubing'),
  ('PNEUMATICS', 'Fittings'),
  ('PNEUMATICS', 'Compressors & tanks'),
  ('HARDWARE', 'Brackets'),
  ('HARDWARE', 'Hinges'),
  ('HARDWARE', 'Standoffs'),
  ('FASTENERS', 'Bolts & screws'),
  ('FASTENERS', 'Nuts'),
  ('FASTENERS', 'Washers'),
  ('FASTENERS', 'Rivets'),
  ('FASTENERS', 'Pins & clips'),
  ('RAW_STOCK', 'Tube'),
  ('RAW_STOCK', 'Sheet'),
  ('RAW_STOCK', 'Bar & rod'),
  ('RAW_STOCK', 'Angle'),
  ('RAW_STOCK', 'Polycarbonate'),
  ('RAW_STOCK', 'Wood'),
  ('CONSUMABLES', 'Tape'),
  ('CONSUMABLES', 'Zip ties'),
  ('CONSUMABLES', 'Adhesives & thread lock'),
  ('CONSUMABLES', 'Lubricants'),
  ('CONSUMABLES', 'Abrasives'),
  ('SAFETY', 'Eye protection'),
  ('SAFETY', 'Gloves'),
  ('SAFETY', 'First aid')
) AS s(category, name);
