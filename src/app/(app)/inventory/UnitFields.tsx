"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { UOM_OPTIONS } from "@/lib/inventory/units";

/** Unit of measure — and, for a partial (part-used) piece, how much is left */
export function UnitFields({ unit = "EACH", amountLeft }: { unit?: string; amountLeft?: string | null }) {
  const [value, setValue] = useState(unit);
  return (
    <>
      <Select label="Unit of measure" name="unitOfMeasure" options={[...UOM_OPTIONS]} value={value} onChange={(e) => setValue(e.target.value)} />
      {value === "PARTIAL" && (
        <div className="col-span-2">
          <Field label="Amount left" name="amountLeft" defaultValue={amountLeft ?? ""} maxLength={120}
            placeholder="e.g. about 18 in, half a sheet, a third of the spool"
            hint="A partial is a part-used piece — give it the same name as the full item so they sit together." />
        </div>
      )}
    </>
  );
}
