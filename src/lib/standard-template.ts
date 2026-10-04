// Standard FRC build-season template tasks — shared between actions and API routes

import type { TaskAnchor } from "@/lib/competition";

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
  /** What startOffset counts from */
  anchor:            TaskAnchor;
  anchorNumber?:     number | null;
}

export const STANDARD_TASKS: StandardTask[] = [
  { name: "Game Analysis Complete",                subTeam: "STRATEGY",    startOffset: 0,   durationBuildDays: 2,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Robot Strategy & Design Brief",         subTeam: "DESIGN",      startOffset: 2,   durationBuildDays: 3,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: ["Game Analysis Complete"], anchor: "KICKOFF" },
  { name: "Subsystem Design Reviews Complete",     subTeam: "MECHANICAL",  startOffset: 5,   durationBuildDays: 5,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: true,  prerequisiteNames: ["Robot Strategy & Design Brief"], anchor: "KICKOFF" },
  { name: "Prototyping Complete",                  subTeam: "MECHANICAL",  startOffset: 10,  durationBuildDays: 4,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Full Robot CAD Complete",               subTeam: "DESIGN",      startOffset: 14,  durationBuildDays: 4,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: ["Subsystem Design Reviews Complete"], anchor: "KICKOFF" },
  { name: "Drivetrain Assembled & Driving",        subTeam: "MECHANICAL",  startOffset: -21, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "All Subsystems Integrated",             subTeam: "MECHANICAL",  startOffset: -14, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: ["Drivetrain Assembled & Driving"], anchor: "SEASON_WEEK0" },
  { name: "Robot Driving with Full Functionality", subTeam: "PROGRAMMING", startOffset: -10, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: ["All Subsystems Integrated"], anchor: "SEASON_WEEK0" },
  { name: "Driver Practice Begins",               subTeam: "DRIVE_TEAM",  startOffset: -7,  durationBuildDays: 2,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "Robot Weight Confirmed Under Limit",   subTeam: "MECHANICAL",  startOffset: -5,  durationBuildDays: 1,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "BOM Complete & Reviewed",              subTeam: "OPERATIONS",  startOffset: -3,  durationBuildDays: 1,  isMilestone: true,  priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "Robot Documentation Package Complete", subTeam: "OPERATIONS",  startOffset: -2,  durationBuildDays: 1,  isMilestone: true,  priority: "MEDIUM",   designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "Week 0 — Robot Done",                  subTeam: null,          startOffset: 0,   durationBuildDays: 1,  isMilestone: true,  priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "Kickoff Game Manual Review",            subTeam: "STRATEGY",    startOffset: 0,   durationBuildDays: 1,  isMilestone: false, priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Field Element Research",               subTeam: "STRATEGY",    startOffset: 0,   durationBuildDays: 2,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Subsystem Assignments Finalized",      subTeam: "OPERATIONS",  startOffset: 3,   durationBuildDays: 2,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Electrical System Design",             subTeam: "ELECTRICAL",  startOffset: 5,   durationBuildDays: 5,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Robot Code Base Setup",                subTeam: "PROGRAMMING", startOffset: 2,   durationBuildDays: 3,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "KICKOFF" },
  { name: "Autonomous Routines Programmed",       subTeam: "PROGRAMMING", startOffset: -14, durationBuildDays: 7,  isMilestone: false, priority: "CRITICAL", designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "Competition Packing List Prepared",    subTeam: "OPERATIONS",  startOffset: -5,  durationBuildDays: 2,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
  { name: "Bumper Construction",                  subTeam: "MECHANICAL",  startOffset: -10, durationBuildDays: 3,  isMilestone: false, priority: "HIGH",     designReviewRequired: false, prerequisiteNames: [], anchor: "SEASON_WEEK0" },
];
