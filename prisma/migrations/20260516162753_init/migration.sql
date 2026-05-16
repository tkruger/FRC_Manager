-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DENIED');

-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('LIGHT', 'DARK', 'AUTO_SYSTEM', 'AUTO_TIME');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEAM_MEMBER', 'BUILD_LEAD', 'INVENTORY_ADMIN', 'BUDGET_MANAGER', 'SAFETY_CAPTAIN', 'HEAD_MENTOR');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('REGIONAL', 'DISTRICT', 'DISTRICT_CHAMPIONSHIP', 'CHAMPIONSHIP', 'WEEK_0', 'OFFSEASON');

-- CreateEnum
CREATE TYPE "RobotRole" AS ENUM ('COMPETITION', 'PRACTICE', 'DEMO', 'RETIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "RobotStatus" AS ENUM ('ACTIVE_BUILD', 'ACTIVE_COMPETITION_READY', 'RETIRED_DISPLAY', 'RETIRED_STORAGE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "ToolType" AS ENUM ('POWER_TOOL', 'HAND_TOOL', 'MEASUREMENT', 'SAFETY_EQUIPMENT', 'ELECTRICAL_TEST', 'FABRICATION_MACHINE', 'PRINTER_3D', 'OTHER');

-- CreateEnum
CREATE TYPE "ToolSpace" AS ENUM ('SHOP_ONLY', 'TRAVELS_TO_COMPETITION', 'COMPETITION_ONLY');

-- CreateEnum
CREATE TYPE "ToolCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'OUT_OF_SERVICE', 'OUT_FOR_MAINTENANCE');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'PNEUMATICS', 'HARDWARE', 'FASTENERS', 'RAW_STOCK', 'CONSUMABLES', 'SAFETY', 'ELECTRONICS', 'SENSORS');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('DISCRETE', 'RAW_MATERIAL', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('EACH', 'PACK', 'FOOT', 'METER', 'INCH', 'SHEET', 'POUND', 'GALLON', 'SPOOL', 'ROLL');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('BASE_INVENTORY', 'KOP', 'FIRST_CHOICE', 'DIRECT', 'DONATED');

-- CreateEnum
CREATE TYPE "InUseStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'INSTALLED_ROBOT', 'INSTALLED_PRACTICE', 'NEEDS_REPAIR', 'OUT_OF_SERVICE', 'RETURNED_TO_BASE');

-- CreateEnum
CREATE TYPE "RobotSubsystem" AS ENUM ('DRIVETRAIN', 'INTAKE', 'SHOOTER', 'CLIMBER', 'ELECTRICAL', 'PNEUMATICS', 'FRAME', 'CONTROLS', 'BUMPERS', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReorderStatus" AS ENUM ('PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'DENIED', 'ORDERED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubTeam" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'PROGRAMMING', 'DRIVE_TEAM', 'STRATEGY', 'DESIGN', 'OUTREACH', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "BudgetCategoryType" AS ENUM ('REGISTRATION_FEES', 'ROBOT_MECHANICAL', 'ROBOT_ELECTRICAL', 'ROBOT_PNEUMATICS', 'RAW_MATERIALS', 'TOOLS_EQUIPMENT', 'CONSUMABLES', 'SAFETY_EQUIPMENT', 'TRAVEL_HOTEL', 'FOOD_MEALS', 'AWARDS_OUTREACH', 'CONTINGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('SCHOOL_ALLOCATION', 'CORPORATE_SPONSOR', 'GRANT', 'FUNDRAISER', 'INDIVIDUAL_DONATION', 'PDV', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('PLEDGED', 'RECEIVED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SponsorType" AS ENUM ('CORPORATE_SPONSOR', 'GRANT', 'IN_KIND_DONATION');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PENDING', 'AGREEMENT_SENT', 'SIGNED', 'THANK_YOU_SENT');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "DesignReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'CHANGES_REQUIRED');

-- CreateEnum
CREATE TYPE "DesignReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('NEAR_MISS', 'MINOR_INJURY', 'SIGNIFICANT_INJURY');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "CheckItemStatus" AS ENUM ('PASS', 'FAIL', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REORDER_TRIGGERED', 'PURCHASE_SUBMITTED', 'PURCHASE_APPROVED', 'PURCHASE_DENIED', 'ORDER_RECEIVED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'TASK_BLOCKED', 'CRITICAL_ISSUE', 'WEIGHT_WARNING', 'BOM_CAP_WARNING', 'TOOL_OVERDUE', 'CERT_EXPIRING', 'SAFETY_INCIDENT', 'COMPETITION_APPROACHING', 'MEMBER_APPROVAL_NEEDED', 'ACCOUNT_APPROVED', 'ACCOUNT_DENIED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "deniedAt" TIMESTAMP(3),
    "deniedReason" TEXT,
    "registrationNote" TEXT,
    "teamId" TEXT,
    "displayMode" "DisplayMode" NOT NULL DEFAULT 'AUTO_SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "accessCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "kickoffDate" TIMESTAMP(3) NOT NULL,
    "week0Date" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "meetingDays" TEXT[],
    "meetingStartTime" TEXT NOT NULL,
    "meetingEndTime" TEXT NOT NULL,
    "expectedAttendance" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEvent" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "eventType" "EventType" NOT NULL DEFAULT 'REGIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Robot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "RobotRole" NOT NULL DEFAULT 'COMPETITION',
    "status" "RobotStatus" NOT NULL DEFAULT 'ACTIVE_BUILD',
    "description" TEXT,
    "weightTarget" DOUBLE PRECISION,
    "photo" TEXT,
    "gallery" TEXT[],
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Robot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightSnapshot" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "toolType" "ToolType" NOT NULL DEFAULT 'OTHER',
    "manufacturer" TEXT,
    "model" TEXT,
    "assetTag" TEXT,
    "serialNumber" TEXT,
    "quantityOwned" INTEGER NOT NULL DEFAULT 1,
    "homeLocation" TEXT,
    "space" "ToolSpace" NOT NULL DEFAULT 'SHOP_ONLY',
    "condition" "ToolCondition" NOT NULL DEFAULT 'GOOD',
    "requiresCertification" BOOLEAN NOT NULL DEFAULT false,
    "certificationName" TEXT,
    "lastMaintenanceDate" TIMESTAMP(3),
    "nextMaintenanceDue" TIMESTAMP(3),
    "maintenanceIntervalDays" INTEGER,
    "replacementCost" DOUBLE PRECISION,
    "image" TEXT,
    "notes" TEXT,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCheckout" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "intendedUse" TEXT,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturn" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnCondition" "ToolCondition",
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ToolCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolMaintenanceLog" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "performedById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "partsReplaced" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCertification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certName" TEXT NOT NULL,
    "certifiedById" TEXT,
    "certifiedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" "CertStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseInventoryItem" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "category" "ItemCategory" NOT NULL DEFAULT 'MECHANICAL',
    "itemType" "ItemType" NOT NULL DEFAULT 'DISCRETE',
    "description" TEXT,
    "unitOfMeasure" "UnitOfMeasure" NOT NULL DEFAULT 'EACH',
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "preferredSupplier" TEXT,
    "alternateSupplier" TEXT,
    "supplierLeadDays" INTEGER,
    "unitCost" DOUBLE PRECISION,
    "isKopItem" BOOLEAN NOT NULL DEFAULT false,
    "kopSeason" INTEGER,
    "isFirstChoiceItem" BOOLEAN NOT NULL DEFAULT false,
    "firstChoiceCreditCost" DOUBLE PRECISION,
    "fairMarketValue" DOUBLE PRECISION,
    "storageLocation" TEXT,
    "image" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InUseInventoryItem" (
    "id" TEXT NOT NULL,
    "robotId" TEXT,
    "baseItemId" TEXT,
    "name" TEXT NOT NULL,
    "source" "ItemSource" NOT NULL DEFAULT 'BASE_INVENTORY',
    "category" "ItemCategory" NOT NULL DEFAULT 'MECHANICAL',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitOfMeasure" "UnitOfMeasure" NOT NULL DEFAULT 'EACH',
    "currentLocation" TEXT,
    "assignedToId" TEXT,
    "status" "InUseStatus" NOT NULL DEFAULT 'AVAILABLE',
    "subsystem" "RobotSubsystem",
    "unitWeight" DOUBLE PRECISION,
    "onRobotBom" BOOLEAN NOT NULL DEFAULT false,
    "packForCompetition" BOOLEAN NOT NULL DEFAULT false,
    "competitionPacked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InUseInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InUseIssue" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "reportedById" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "InUseIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReorderRequest" (
    "id" TEXT NOT NULL,
    "baseItemId" TEXT NOT NULL,
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "status" "ReorderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReorderRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "frcDiscount" TEXT,
    "typicalLeadDays" INTEGER,
    "primaryContact" TEXT,
    "accountNumber" TEXT,
    "notes" TEXT,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDonationVoucher" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usageConditions" TEXT,
    "redeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDonationVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subTeam" "SubTeam",
    "priority" "RequestPriority" NOT NULL DEFAULT 'ROUTINE',
    "justification" TEXT,
    "linkedTaskId" TEXT,
    "preferredVendorId" TEXT,
    "estimatedTotal" DOUBLE PRECISION,
    "budgetCategory" "BudgetCategoryType",
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "approverId" TEXT,
    "approvalNotes" TEXT,
    "orderDate" TIMESTAMP(3),
    "expectedDelivery" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "orderConfirmation" TEXT,
    "actualTotal" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLineItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "vendorProductUrl" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitOfMeasure" "UnitOfMeasure" NOT NULL DEFAULT 'EACH',
    "unitCost" DOUBLE PRECISION,
    "lineTotal" DOUBLE PRECISION,
    "baseItemId" TEXT,
    "goesOnRobotBom" BOOLEAN NOT NULL DEFAULT false,
    "isKopSource" BOOLEAN NOT NULL DEFAULT false,
    "qtyReceived" DOUBLE PRECISION,

    CONSTRAINT "PurchaseLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "totalEstRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCategory" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "type" "BudgetCategoryType" NOT NULL,
    "label" TEXT NOT NULL,
    "allocation" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingSource" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FundingType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "FundingStatus" NOT NULL DEFAULT 'PLEDGED',
    "receivedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vendor" TEXT,
    "description" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "isCommitment" BOOLEAN NOT NULL DEFAULT false,
    "purchaseRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SponsorType" NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "amount" DOUBLE PRECISION,
    "inKindValue" DOUBLE PRECISION,
    "season" INTEGER,
    "agreementStatus" "AgreementStatus" NOT NULL DEFAULT 'PENDING',
    "renewalEligible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "inUseItemId" TEXT,
    "partName" TEXT NOT NULL,
    "partNumber" TEXT,
    "subsystem" "RobotSubsystem",
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitFmv" DOUBLE PRECISION,
    "totalFmv" DOUBLE PRECISION,
    "source" "ItemSource" NOT NULL DEFAULT 'DIRECT',
    "exemptUnder5" BOOLEAN NOT NULL DEFAULT false,
    "exemptKop" BOOLEAN NOT NULL DEFAULT false,
    "exemptFirstChoice" BOOLEAN NOT NULL DEFAULT false,
    "fmvConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomExport" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedById" TEXT,
    "format" TEXT NOT NULL,
    "fileUrl" TEXT,
    "eventName" TEXT,

    CONSTRAINT "BomExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "robotId" TEXT,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subTeam" "SubTeam",
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "startOffset" INTEGER,
    "durationBuildDays" INTEGER,
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "blockersNotes" TEXT,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "designReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "designReviewStatus" "DesignReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "isTemplateTask" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "completionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignReview" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "description" TEXT,
    "subsystem" "RobotSubsystem",
    "reviewDate" TIMESTAMP(3),
    "decision" "DesignReviewDecision",
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subTeam" "SubTeam",
    "startOffset" INTEGER NOT NULL,
    "durationBuildDays" INTEGER NOT NULL DEFAULT 1,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedHours" DOUBLE PRECISION,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "designReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "prerequisiteNames" TEXT[],

    CONSTRAINT "TemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "toolOrMaterial" TEXT,
    "peopleInvolved" TEXT,
    "severity" "IncidentSeverity" NOT NULL,
    "immediateAction" TEXT,
    "correctiveAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklist" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "eventName" TEXT,
    "runNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionCheckItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CheckItemStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "notes" TEXT,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "InspectionCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreMatchChecklist" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "matchNumber" TEXT,
    "eventName" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreMatchChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreMatchCheckItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "PreMatchCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InUseInventoryItemToTask" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InUseInventoryItemToTask_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TaskAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TaskDependencies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskDependencies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamNumber_key" ON "Team"("teamNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Season_teamId_year_key" ON "Season"("teamId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "UserCertification_userId_certName_key" ON "UserCertification"("userId", "certName");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_seasonId_key" ON "Budget"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "BomItem_inUseItemId_key" ON "BomItem"("inUseItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignReview_taskId_key" ON "DesignReview"("taskId");

-- CreateIndex
CREATE INDEX "_InUseInventoryItemToTask_B_index" ON "_InUseInventoryItemToTask"("B");

-- CreateIndex
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- CreateIndex
CREATE INDEX "_TaskDependencies_B_index" ON "_TaskDependencies"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEvent" ADD CONSTRAINT "CompetitionEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightSnapshot" ADD CONSTRAINT "WeightSnapshot_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolMaintenanceLog" ADD CONSTRAINT "ToolMaintenanceLog_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolMaintenanceLog" ADD CONSTRAINT "ToolMaintenanceLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseInventoryItem" ADD CONSTRAINT "BaseInventoryItem_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InUseInventoryItem" ADD CONSTRAINT "InUseInventoryItem_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InUseInventoryItem" ADD CONSTRAINT "InUseInventoryItem_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "BaseInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InUseIssue" ADD CONSTRAINT "InUseIssue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InUseInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderRequest" ADD CONSTRAINT "ReorderRequest_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "BaseInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDonationVoucher" ADD CONSTRAINT "ProductDonationVoucher_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "BaseInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingSource" ADD CONSTRAINT "FundingSource_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_inUseItemId_fkey" FOREIGN KEY ("inUseItemId") REFERENCES "InUseInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignReview" ADD CONSTRAINT "DesignReview_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTask" ADD CONSTRAINT "TemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SeasonTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionCheckItem" ADD CONSTRAINT "InspectionCheckItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "InspectionChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreMatchCheckItem" ADD CONSTRAINT "PreMatchCheckItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "PreMatchChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InUseInventoryItemToTask" ADD CONSTRAINT "_InUseInventoryItemToTask_A_fkey" FOREIGN KEY ("A") REFERENCES "InUseInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InUseInventoryItemToTask" ADD CONSTRAINT "_InUseInventoryItemToTask_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDependencies" ADD CONSTRAINT "_TaskDependencies_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDependencies" ADD CONSTRAINT "_TaskDependencies_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
