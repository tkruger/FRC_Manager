// Standard FRC build-season template tasks — shared between actions and API routes

export interface StandardTask {
  name:              string;
  description?:      string;
  subTeam:           string | null;
  startOffset:       number;
  durationBuildDays: number;
  priority:          string;
  estimatedHours?:   number;
  isMilestone:       boolean;
  designReviewRequired: boolean;
  prerequisiteNames: string[];
}

export const STANDARD_TASKS: StandardTask[] = [
  { name: "Game Analysis Complete",                subTeam: "STRATEGY",    startOffset: 0,   durationBuildDays: 2,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Robot Strategy & Design Brief",         subTeam: "DESIGN",      startOffset: 2,   durationBuildDays: 3,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: ["Game Analysis Complete"] },
  { name: "Subsystem Design Reviews Complete",     subTeam: "MECHANICAL",  startOffset: 5,   durationBuildDays: 5,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: true,  prerequisiteNames: ["Robot Strategy & Design Brief"] },
  { name: "Prototyping Complete",                  subTeam: "MECHANICAL",  startOffset: 10,  durationBuildDays: 4,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Full Robot CAD Complete",               subTeam: "DESIGN",      startOffset: 14,  durationBuildDays: 4,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: ["Subsystem Design Reviews Complete"] },
  { name: "Drivetrain Assembled & Driving",        subTeam: "MECHANICAL",  startOffset: -21, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [] },
  { name: "All Subsystems Integrated",             subTeam: "MECHANICAL",  startOffset: -14, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: ["Drivetrain Assembled & Driving"] },
  { name: "Robot Driving with Full Functionality", subTeam: "PROGRAMMING", startOffset: -10, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: ["All Subsystems Integrated"] },
  { name: "Driver Practice Begins",               subTeam: "DRIVE_TEAM",  startOffset: -7,  durationBuildDays: 2,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Robot Weight Confirmed Under Limit",   subTeam: "MECHANICAL",  startOffset: -5,  durationBuildDays: 1,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "BOM Complete & Reviewed",              subTeam: "OPERATIONS",  startOffset: -3,  durationBuildDays: 1,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Robot Documentation Package Complete", subTeam: "OPERATIONS",  startOffset: -2,  durationBuildDays: 1,  isMilestone: true,  priority: "MEDIUM",   designReviewRequired: false, prerequisiteNames: [] },
  { name: "Week 0 — Robot Done",                  subTeam: null,          startOffset: 0,   durationBuildDays: 1,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [] },
  { name: "Kickoff Game Manual Review",            subTeam: "STRATEGY",    startOffset: 0,   durationBuildDays: 1,  isMilestone: false, priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [] },
  { name: "Field Element Research",               subTeam: "STRATEGY",    startOffset: 0,   durationBuildDays: 2,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Subsystem Assignments Finalized",      subTeam: "OPERATIONS",  startOffset: 3,   durationBuildDays: 2,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Electrical System Design",             subTeam: "ELECTRICAL",  startOffset: 5,   durationBuildDays: 5,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Robot Code Base Setup",                subTeam: "PROGRAMMING", startOffset: 2,   durationBuildDays: 3,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Autonomous Routines Programmed",       subTeam: "PROGRAMMING", startOffset: -14, durationBuildDays: 7,  isMilestone: false, priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [] },
  { name: "Competition Packing List Prepared",    subTeam: "OPERATIONS",  startOffset: -5,  durationBuildDays: 2,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
  { name: "Bumper Construction",                  subTeam: "MECHANICAL",  startOffset: -10, durationBuildDays: 3,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [] },
];
