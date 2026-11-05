// What the app tour says, for each kind of person. Each step points at part of the screen
// (data-tour="…" — the first one that's visible, so phones get the bottom bar and computers the top
// tabs), or sits in the middle when it has nothing to point at. Steps whose targets aren't on the
// screen are skipped. Client-safe.

import Link from "next/link";
import {
  CoordinatorCoveragePreview, CoordinatorFillPreview, CoordinatorSetupPreview, VolunteerAskPreview, VolunteerSignupPreview,
} from "./TourPreviews";
import {
  Bell, Bot, BookOpen, CalendarCheck, CalendarRange, ClipboardList, Compass, HandHeart, House, LayoutGrid, Menu, MessageSquareReply,
  PartyPopper, Swords, UserRound, UsersRound, type LucideIcon,
} from "lucide-react";

export type TourAudience = "parent" | "student" | "mentor" | "head_mentor";

export interface TourStep {
  id: string;
  /** data-tour names to point at, in order of preference; none = a card in the middle */
  target?: string[];
  /** Keep the step (as a card in the middle) when its target isn't on this screen */
  optional?: boolean;
  /** A drawn preview of a screen it describes (see TourPreviews) */
  preview?: React.ReactNode;
  title: string;
  body: React.ReactNode;
  /** The picture at the top of the card, and how it moves */
  icon?: LucideIcon;
  motion?: "bob" | "swing";
  /** Badge colors (a gradient) */
  tint?: [string, string];
}

export const WELCOME_ICON = Compass;

const Li = ({ children }: { children: React.ReactNode }) => <li>{children}</li>;
const List = ({ children }: { children: React.ReactNode }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>;

// ── "New to FRC?" — four cards before the tour ──────────────────────────────

export const FRC_PRIMER: TourStep[] = [
  {
    id: "frc-what", title: "What is FRC?", icon: Bot, motion: "bob", tint: ["#F97316", "#DC2626"],
    body: <>
      <p><b>FIRST Robotics Competition</b> is a high-school robotics program run by FIRST. Each year teams design, build and program a
        robot — about the size of a dishwasher — to play a brand-new game against other teams.</p>
      <p className="mt-2">It&apos;s about more than robots: students run the team like a small company — engineering, programming,
        business, outreach — with mentors guiding, not doing.</p>
    </>,
  },
  {
    id: "frc-season", title: "A season at a glance", icon: CalendarRange, tint: ["#0EA5E9", "#6366F1"],
    body: <List>
      <Li><b>Kickoff</b> (early January) — the year&apos;s game is revealed.</Li>
      <Li><b>Build season</b> — about eight weeks of designing, building and practicing.</Li>
      <Li><b>Competitions</b> (March–April) — weekend events, usually two or more per team.</Li>
      <Li><b>Championships</b> — state or district championships, then the FIRST Championship in April.</Li>
      <Li><b>Off-season</b> — summer and fall events, outreach, and training new members.</Li>
    </List>,
  },
  {
    id: "frc-events", title: "At a competition", icon: Swords, tint: ["#DC2626", "#2563EB"],
    body: <>
      <p>Matches are <b>three robots against three</b> — a red alliance and a blue one — for 2½ minutes: 15 seconds of the robot
        driving itself, then the drive team takes over. The <b>bumper color</b> shows which side a robot is on.</p>
      <p className="mt-2">After qualification matches the top teams pick partners for the <b>playoffs</b>, and awards — many for the
        team, not the robot — are given out along the way.</p>
    </>,
  },
  {
    id: "frc-words", title: "Words you'll hear", icon: BookOpen, tint: ["#14B8A6", "#0F766E"],
    body: <>
      <List>
        <Li><b>Pit</b> — the team&apos;s workshop area at an event.</Li>
        <Li><b>Drive team</b> — the students who drive the robot in matches.</Li>
        <Li><b>Scouting</b> — watching other teams to pick good partners.</Li>
        <Li><b>Gracious Professionalism</b> — compete hard, help everyone, including rivals.</Li>
      </List>
      <p className="mt-2">There&apos;s more in <Link href="/help/frc-basics" className="text-(--color-secondary) underline">FRC basics</Link> any time.</p>
    </>,
  },
];

// ── Volunteering (parents) ──────────────────────────────────────────────────

const VOLUNTEERS_TAB = ["nav:/volunteers"];

export const VOLUNTEER_STEPS: TourStep[] = [
  {
    id: "vol-signup", target: VOLUNTEERS_TAB, optional: true, title: "Volunteering at meetings",
    icon: HandHeart, motion: "bob", tint: ["#EC4899", "#F97316"], preview: <VolunteerSignupPreview />,
    body: <>
      <p>Every meeting needs adults there — usually at least two. Here&apos;s how it works:</p>
      <List>
        <Li><b>Get cleared</b> — a Head Mentor marks you <b>cleared to volunteer</b>, usually once the school&apos;s background check is done.</Li>
        <Li><b>Sign up</b> — open <b>Volunteers</b> and tap <b>Sign up</b> on any upcoming meeting. You&apos;re confirmed straight away.</Li>
        <Li>Add your <b>phone number</b> in your Profile so the coordinator can reach you on the day.</Li>
      </List>
    </>,
  },
  {
    id: "vol-respond", title: "When you're asked to help",
    icon: MessageSquareReply, tint: ["#8B5CF6", "#EC4899"], preview: <VolunteerAskPreview />,
    body: <List>
      <Li>The volunteer coordinator may <b>ask you to cover</b> a meeting. It shows at the <b>top of Home</b>, as a notification and by email — tap <b>Confirm</b> or <b>Can&apos;t make it</b>.</Li>
      <Li>The <b>day before</b> each shift you get a reminder with the <b>shift instructions</b> — where to go, when, and what to do.</Li>
      <Li>Plans changed? Under <b>Your shifts</b> on the Volunteers page, tap <b>Can&apos;t make it</b> — the coordinator is told.</Li>
    </List>,
  },
];

// ── Coordinating volunteers (Volunteer Coordinators, Head Mentors) ──────────

export const COORDINATOR_STEPS: TourStep[] = [
  {
    id: "coord-coverage", target: VOLUNTEERS_TAB, optional: true, title: "Coordinating volunteers",
    icon: UsersRound, tint: ["#0EA5E9", "#8B5CF6"], preview: <CoordinatorCoveragePreview />,
    body: <>
      <p>The <b>Volunteers</b> page lists the next eight weeks of meetings and how many adults are confirmed for each.</p>
      <List>
        <Li>Meetings without enough confirmed adults are marked in <b>red</b> — there and on the calendar. <b>Only meetings that need adults</b> narrows the list.</Li>
        <Li>The <b>roster</b> shows every adult, whether they&apos;re cleared (and until when), and their upcoming shifts.</Li>
      </List>
    </>,
  },
  {
    id: "coord-fill", title: "Filling a meeting",
    icon: CalendarCheck, tint: ["#22C55E", "#0EA5E9"], preview: <CoordinatorFillPreview />,
    body: <List>
      <Li><b>Ask someone to cover…</b> on a meeting sends a cleared adult a request (a notification and an email). Unanswered asks get a morning nudge as the meeting gets close.</Li>
      <Li>They confirm or say they can&apos;t — you&apos;re told if a meeting is short again. The <b>×</b> next to a name takes them off.</Li>
      <Li>Only cleared adults can be asked; Head Mentors clear people in <b>Team members</b>.</Li>
    </List>,
  },
  {
    id: "coord-setup", title: "Instructions and reminders",
    icon: ClipboardList, tint: ["#F59E0B", "#EC4899"], preview: <CoordinatorSetupPreview />,
    body: <List>
      <Li><b>Edit Shift Instructions</b> (top of the Volunteers page) sets how many adults a meeting needs and the default <b>shift instructions</b> sent with every sign-up and day-before reminder.</Li>
      <Li>A meeting can have its <b>own instructions</b> instead — for a competition or an outreach event.</Li>
      <Li>Each morning you get the next two weeks&apos; meetings that are still short; with a parent Discord server, it&apos;s also posted in its Volunteers channel.</Li>
    </List>,
  },
];

// ── The tour itself ─────────────────────────────────────────────────────────

const bell: TourStep = {
  id: "bell", target: ["bell"], title: "Notifications", icon: Bell, motion: "swing", tint: ["#F59E0B", "#EA580C"],
  body: <>The bell has everything the app tells you — and the same arrives as push notifications on your phone if you turn them on.
    Choose what you hear about in <b>Notification settings</b> (profile menu).</>,
};

const help = (extra?: React.ReactNode): TourStep => ({
  id: "done", title: "You're all set", icon: PartyPopper, tint: ["#22C55E", "#0D9488"],
  body: <>
    {extra}
    <p>Every page has a <b>Guide</b> button that explains it, and <Link href="/help" className="text-(--color-secondary) underline">Help &amp; guide</Link> covers
      everything. Something confusing or broken? <b>Give feedback</b> (bottom of every page) goes straight to the people who build the app.</p>
    <p className="mt-2 text-(--color-text-secondary)">Take this tour again any time from the profile menu.</p>
  </>,
});

const STEPS: Record<TourAudience, TourStep[]> = {
  parent: [
    {
      id: "nav", target: ["bottom-bar", "top-tabs"], icon: LayoutGrid, tint: ["#8B5CF6", "#6366F1"], title: "Your main sections",
      body: <List>
        <Li><b>Volunteers</b> — sign up to help at meetings (once a Head Mentor clears you).</Li>
        <Li><b>Calendar</b> — every meeting, with changes as they happen.</Li>
        <Li><b>Events</b> — our competitions: the next match, our bumper color, results and the livestream.</Li>
        <Li><b>Season</b> — this year&apos;s dates and competitions.</Li>
      </List>,
    },
    {
      id: "more", target: ["more"], icon: Menu, tint: ["#64748B", "#334155"], title: "Everything else is under More",
      body: <>Home, Tasks, Tools, Safety, Inventory, the Budget, and <b>Expenses</b> — where you submit something you bought for the
        team, and ask to be paid back.</>,
    },
    { ...bell, body: <>{bell.body} You&apos;ll hear about meeting changes, volunteer requests and live competition updates — which you can
      <b> snooze</b> when you&apos;re not at an event.</> },
    {
      id: "profile", target: ["profile"], icon: UserRound, tint: ["#EC4899", "#8B5CF6"], title: "Your profile menu",
      body: <List>
        <Li><b>Profile &amp; appearance</b> — your name, a phone number for the volunteer coordinator, colors and dark mode.</Li>
        <Li><b>Notification settings</b>, <b>Help &amp; guide</b> and <b>Give feedback</b>.</Li>
      </List>,
    },
    {
      id: "home", target: ["home-stats", "home-tiles"], icon: House, tint: ["#10B981", "#0EA5E9"], title: "Home puts you first",
      body: <>Anything waiting on you — like a request to volunteer — shows at the top, then your next shift, the next competition, and the
        team&apos;s budget.</>,
    },
    help(<p className="mb-2">Your account is <b>view-only</b>: you see what the team sees, and can volunteer, help pack for competitions,
      scan tools into place and submit expenses.</p>),
  ],

  student: [
    {
      id: "nav", target: ["bottom-bar", "top-tabs"], icon: LayoutGrid, tint: ["#8B5CF6", "#6366F1"], title: "Your main sections",
      body: <List>
        <Li><b>Tasks</b> — what you&apos;re working on, as a board or a schedule. Move your cards as you go.</Li>
        <Li><b>Calendar</b> — every meeting, including your sub-team&apos;s.</Li>
        <Li><b>Events</b> — competitions: our next match, bumper color and results.</Li>
        <Li><b>Tools</b> — check tools out and back in (some need a safety certification first).</Li>
      </List>,
    },
    {
      id: "more", target: ["more"], icon: Menu, tint: ["#64748B", "#334155"], title: "Everything else is under More",
      body: <>Home, <b>Safety</b> (certifications and reporting an issue), <b>Inventory</b> (parts and materials), <b>Orders</b> (ask for
        parts to be bought), the Budget, Expenses, the robot Fleet, and the Season.</>,
    },
    { ...bell, body: <>{bell.body} You&apos;ll hear when you&apos;re given a task, before meetings — with your open tasks as each meeting
      starts — and during competitions.</> },
    {
      id: "profile", target: ["profile"], icon: UserRound, tint: ["#EC4899", "#8B5CF6"], title: "Your profile menu",
      body: <List>
        <Li><b>Profile &amp; appearance</b> — pick <b>your sub-teams</b> (so you get their meetings), colors and dark mode.</Li>
        <Li><b>Notification settings</b>, <b>Help &amp; guide</b> and <b>Give feedback</b>.</Li>
      </List>,
    },
    {
      id: "home", target: ["home-stats", "home-tiles"], icon: House, tint: ["#10B981", "#0EA5E9"], title: "Home",
      body: <>The countdown to what&apos;s next, overdue tasks, the budget, and shortcuts to every part of the app.</>,
    },
    help(),
  ],

  mentor: [
    {
      id: "nav", target: ["bottom-bar", "top-tabs"], icon: LayoutGrid, tint: ["#8B5CF6", "#6366F1"], title: "Your main sections",
      body: <List>
        <Li><b>Tasks</b> — the build plan: who&apos;s doing what, and what&apos;s late.</Li>
        <Li><b>Orders</b> — parts requests, and the ones waiting on you to approve or buy.</Li>
        <Li><b>Budget</b> — money raised, pledged and spent.</Li>
        <Li><b>Calendar</b> — meetings, and which ones still need adult volunteers.</Li>
      </List>,
    },
    {
      id: "more", target: ["more"], icon: Menu, tint: ["#64748B", "#334155"], title: "Everything else is under More",
      body: <>Home, Events (competitions), <b>Volunteers</b>, Tools, Safety, Inventory, Expenses, the robot Fleet and the Season.</>,
    },
    { ...bell, body: <>{bell.body} Orders waiting on you get reminders until they&apos;re handled.</> },
    {
      id: "profile", target: ["profile"], icon: UserRound, tint: ["#EC4899", "#8B5CF6"], title: "Your profile menu",
      body: <>Your profile and sub-teams, notification settings, Help &amp; guide and Give feedback — plus anything your roles add, like
        <b> Templates</b> or <b>Team members</b>.</>,
    },
    {
      id: "home", target: ["home-stats", "home-tiles"], icon: House, tint: ["#10B981", "#0EA5E9"], title: "Home",
      body: <>What&apos;s next, overdue tasks, orders waiting for approval, and the budget — at a glance.</>,
    },
    help(<p className="mb-2">What you can change depends on your roles — <Link href="/settings/roles" className="text-(--color-secondary) underline">Roles explained</Link> lists them.</p>),
  ],

  head_mentor: [
    {
      id: "nav", target: ["bottom-bar", "top-tabs"], icon: LayoutGrid, tint: ["#8B5CF6", "#6366F1"], title: "Your main sections",
      body: <List>
        <Li><b>Tasks</b>, <b>Orders</b>, <b>Budget</b> and <b>Calendar</b> first — the rest are a tap away.</Li>
        <Li>As Head Mentor you can change everything: tasks, orders and approvals, the budget, meetings and the season.</Li>
      </List>,
    },
    {
      id: "more", target: ["more"], icon: Menu, tint: ["#64748B", "#334155"], title: "Everything else is under More",
      body: <>Home, Events, Volunteers, Tools, Safety, Inventory, Expenses, the robot Fleet, and <b>Season</b> — where the season&apos;s dates,
        meeting schedule and competitions are set up.</>,
    },
    bell,
    {
      id: "profile", target: ["profile"], icon: UserRound, tint: ["#EC4899", "#8B5CF6"], title: "Running the team",
      body: <List>
        <Li><b>Team members</b> — approve people who ask to join, and give roles.</Li>
        <Li><b>Broadcast message</b> — one message to students, parents and/or mentors.</Li>
        <Li><b>Integrations</b> — the team&apos;s email, Discord, and The Blue Alliance.</Li>
        <Li><b>Audit log</b>, <b>Templates</b> and the <b>Purchase workflow</b>.</Li>
      </List>,
    },
    {
      id: "home", target: ["home-stats", "home-tiles"], icon: House, tint: ["#10B981", "#0EA5E9"], title: "Home",
      body: <>What&apos;s next, overdue tasks, orders waiting for approval, and the budget — at a glance.</>,
    },
    help(<p className="mb-2">Setting up email, Discord or competition data? The <Link href="/help/integrations" className="text-(--color-secondary) underline">integration setup guide</Link> walks through it.</p>),
  ],
};

export const AUDIENCE_LABEL: Record<TourAudience, string> = {
  parent: "parents", student: "students", mentor: "mentors", head_mentor: "Head Mentors",
};

/**
 * The tour for this person: the main steps, then (before the last card) volunteering for parents, and
 * coordinating for Volunteer Coordinators and Head Mentors.
 */
export function tourSteps(a: TourAudience, opts: { coordinator?: boolean } = {}): TourStep[] {
  const main = STEPS[a];
  const extra = [...(a === "parent" ? VOLUNTEER_STEPS : []), ...(opts.coordinator ? COORDINATOR_STEPS : [])];
  return [...main.slice(0, -1), ...extra, main[main.length - 1]];
}
