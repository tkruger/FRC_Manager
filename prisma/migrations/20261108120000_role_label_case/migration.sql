-- Role names in title case, like the others: "Order approver" -> "Order Approver" in saved
-- purchase workflows and order history (from the Treasurer rename). No-op where absent.
UPDATE "WorkflowDefinition"
SET "definition" = replace("definition"::text, 'Order approver', 'Order Approver')::jsonb
WHERE "definition"::text LIKE '%Order approver%';

UPDATE "PurchaseRequestEvent"
SET "data" = replace("data"::text, 'Order approver', 'Order Approver')::jsonb
WHERE "data"::text LIKE '%Order approver%';

UPDATE "PurchaseRequestEvent"
SET "note" = replace("note", 'Order approver', 'Order Approver')
WHERE "note" LIKE '%Order approver%';

UPDATE "PurchaseRequestEvent"
SET "stepName" = replace("stepName", 'Order approver', 'Order Approver')
WHERE "stepName" LIKE '%Order approver%';
