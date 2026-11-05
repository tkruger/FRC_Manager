import Link from "next/link";

// FRC basics: for parents and students new to FIRST Robotics — what it is, how a season and an
// event go, the words people use, and how families help.

const SECTIONS = [
  { id: "what",    title: "What FRC is" },
  { id: "season",  title: "A season, month by month" },
  { id: "match",   title: "How a match works" },
  { id: "event",   title: "At a competition" },
  { id: "team",    title: "How a team works" },
  { id: "words",   title: "Words you'll hear" },
  { id: "parents", title: "How families help" },
  { id: "more",    title: "Learn more" },
];

const WORDS: [string, string][] = [
  ["FIRST", "The nonprofit behind FRC (and FTC and FLL for younger students): \"For Inspiration and Recognition of Science and Technology\"."],
  ["Kickoff", "The day in early January the season's game is revealed. Teams spend it reading the rules and brainstorming."],
  ["Build season", "The weeks after kickoff spent designing, building, programming and practicing."],
  ["Regional / District", "The two kinds of competition. Regionals are standalone events; in district areas teams earn points at smaller local events toward a district championship."],
  ["Week 1, Week 2…", "Competitions are numbered by the week of the season they're in. \"Week 0\" events are unofficial practice scrimmages."],
  ["Alliance", "Three teams playing together in a match — red or blue. Partners change every qualification match."],
  ["Bumpers", "Padded fabric around the robot's frame, red or blue for its alliance in that match — the easiest way to spot your team."],
  ["Autonomous (auto)", "The first 15 seconds of a match, when robots run on their own programming."],
  ["Teleop", "The rest of the match, when the drive team controls the robot."],
  ["Drive team", "The students who drive, operate and coach the robot during matches; a human player may help on the field."],
  ["Pit", "The team's small workshop area at an event, where the robot is repaired between matches. Visitors are welcome."],
  ["Queuing", "Lining up with the robot next to the field a few matches before it plays."],
  ["Qualification matches", "The first rounds, with random partners. Teams earn ranking points toward a ranking."],
  ["Alliance selection", "After qualifying, the top-ranked teams become captains and pick partners for the playoffs."],
  ["Playoffs", "Double-elimination rounds between the alliances; the last alliance standing wins the event."],
  ["Scouting", "Students recording how other teams' robots perform, to choose good alliance partners."],
  ["Impact Award", "FRC's most prestigious award — for a team's long-term impact on its community, not its robot."],
  ["Gracious Professionalism", "FIRST's core value: compete fiercely, but treat everyone with respect and help other teams — even the ones you're playing against."],
  ["Coopertition", "Competing and cooperating at the same time — like lending a part to the team you'll face next."],
  ["Mentors", "Adult volunteers (engineers, teachers, parents…) who teach and guide. Students do the work; mentors help them learn."],
];

export default function FrcBasicsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/help" className="hover:text-(--color-primary)">Help &amp; guide</Link>
          <span className="mx-2">›</span>FRC basics
        </nav>
        <h1 className="text-h1 text-(--color-text-primary)">FRC basics</h1>
        <p className="text-body text-(--color-text-secondary) mt-1">
          New to FIRST Robotics? Here&apos;s what it&apos;s all about — for students joining the team and families cheering them on.
        </p>
      </div>

      <nav aria-label="Contents" className="card">
        <ol className="grid gap-1 sm:grid-cols-2 text-sm list-decimal pl-5">
          {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-(--color-secondary) hover:underline">{s.title}</a></li>)}
        </ol>
      </nav>

      <Section id="what" title="What FRC is">
        <p>
          The <b>FIRST Robotics Competition</b> is a worldwide program for high-school students. Every year there&apos;s a brand-new game,
          and each team has a few months to design, build and program a robot to play it — robots weigh up to about 125 pounds and are
          roughly the size of a dishwasher.
        </p>
        <p>
          It&apos;s often called &quot;the hardest fun you&apos;ll ever have&quot;. Students learn engineering, programming, design and
          teamwork, but also run the team like a small business: fundraising, marketing, community outreach and planning. Mentors guide;
          students do the work.
        </p>
      </Section>

      <Section id="season" title="A season, month by month">
        <Table rows={[
          ["Fall (off-season)", "Training new members, practice projects, outreach, fundraising, and off-season events with last year's robot."],
          ["Early January", "Kickoff: the game and its rules are revealed. Teams decide on a strategy."],
          ["January – February", "Build season: prototyping, building, programming and drive practice — the busiest weeks, with the most meetings."],
          ["Late February", "Week 0 practice events (optional scrimmages)."],
          ["March – April", "Competition season: most teams attend two or more weekend events (Weeks 1–6)."],
          ["April", "District or state championships, then the FIRST Championship for qualifying teams."],
          ["Summer", "Off-season competitions, demonstrations and planning for next year."],
        ]} />
      </Section>

      <Section id="match" title="How a match works">
        <ul className="list">
          <li>Two alliances of three robots — <b>red</b> and <b>blue</b> — play for about <b>2½ minutes</b>.</li>
          <li>The first <b>15 seconds</b> are <b>autonomous</b>: the robots move on their own. Then the drive teams take over for the rest.</li>
          <li>Points come from the year&apos;s tasks (scoring game pieces, climbing, and so on), with bonus <b>ranking points</b> for hitting goals.</li>
          <li>The <b>bumper color</b> tells you which side our robot is on — it changes from match to match.</li>
        </ul>
      </Section>

      <Section id="event" title="At a competition">
        <ul className="list">
          <li><b>Friday or the first day</b>: inspection (the robot is checked against the rules), practice matches.</li>
          <li><b>Qualification matches</b>: each team plays about 10–12 matches with random partners; rankings update after each.</li>
          <li><b>Alliance selection</b>: the top 8 teams become captains and pick two partners each.</li>
          <li><b>Playoffs</b>: double elimination — an alliance is out after two losses — ending in a best-of-three final.</li>
          <li><b>Awards</b> are given throughout, many for the team&apos;s work beyond the robot.</li>
        </ul>
        <p>
          Events are loud, busy and a lot of fun — bring ear plugs, a water bottle and team colors. The team&apos;s page under{" "}
          <Link href="/competitions" className="link">Events</Link> shows our next match, bumper color, results and the livestream.
        </p>
      </Section>

      <Section id="team" title="How a team works">
        <ul className="list">
          <li><b>Sub-teams</b> — mechanical, electrical, programming, design, strategy and scouting, outreach, operations. Students can be in more than one.</li>
          <li><b>Student leaders</b> run day-to-day work; <b>mentors</b> teach and keep things safe; <b>Head Mentors</b> run the program.</li>
          <li><b>Safety</b> comes first: tools that need training require a certification before students use them.</li>
        </ul>
      </Section>

      <Section id="words" title="Words you'll hear">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[11rem_1fr]">
          {WORDS.map(([w, d]) => (
            <div key={w} className="contents">
              <dt className="font-semibold text-(--color-text-primary)">{w}</dt>
              <dd className="text-(--color-text-secondary)">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="parents" title="How families help">
        <ul className="list">
          <li><b>Volunteer at meetings</b> — every meeting needs adults there. Once a Head Mentor clears you, sign up under <Link href="/volunteers" className="link">Volunteers</Link>.</li>
          <li><b>At events</b> — chaperoning, driving, meals and cheering. FIRST also needs event volunteers (field reset, queuing, inspection).</li>
          <li><b>Behind the scenes</b> — fundraising, sponsor contacts, and skills you bring from work.</li>
          <li>Bought something for the team? Submit it under <b>Expenses</b> to be paid back.</li>
        </ul>
      </Section>

      <Section id="more" title="Learn more">
        <ul className="list">
          <li><a className="link" href="https://www.firstinspires.org/robotics/frc" target="_blank" rel="noopener noreferrer">FIRST Robotics Competition</a> — the official site, including this season&apos;s game.</li>
          <li><a className="link" href="https://www.thebluealliance.com" target="_blank" rel="noopener noreferrer">The Blue Alliance</a> — results and videos of every match.</li>
          <li><a className="link" href="https://www.match13.com" target="_blank" rel="noopener noreferrer">Match13</a> — team rankings and match predictions.</li>
          <li>In this app: <Link href="/help" className="link">Help &amp; guide</Link>, and the tour (profile menu → Take the tour).</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 space-y-3 text-sm text-(--color-text-primary) [&_.list]:list-disc [&_.list]:pl-5 [&_.list]:space-y-1.5 [&_.link]:text-(--color-secondary) [&_.link]:underline">
      <h2 className="text-h2 text-(--color-text-primary)">{title}</h2>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-(--color-border)">
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-(--color-border)">
          {rows.map((r) => (
            <tr key={r[0]}><td className="w-44 px-3 py-2 align-top font-medium">{r[0]}</td><td className="px-3 py-2 text-(--color-text-secondary)">{r[1]}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
