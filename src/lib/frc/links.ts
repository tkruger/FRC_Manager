// Links to the FRC sites people follow events on. They all share The Blue Alliance's codes:
// a team is its number, an event is like "2026casnv", a match like "2026casnv_qm14".
// Safe on server and client; needs no API key.

export const TBA_APP_IOS = "https://apps.apple.com/us/app/the-blue-alliance/id1441973916";
export const TBA_APP_ANDROID = "https://play.google.com/store/apps/details?id=com.thebluealliance.androidclient";

/** A Blue Alliance event code: year + event (e.g. 2026casnv) */
export const EVENT_KEY = /^\d{4}[a-z0-9]{2,16}$/;

export function normalizeEventKey(input: string): string | null {
  // Accept a pasted link too: …/event/2026casnv or …frc.nexus/en/event/2026casnv
  const s = input.trim().toLowerCase();
  // FIRST's links split the year and event: frc-events.firstinspires.org/2026/CASNV
  const first = s.match(/firstinspires\.org\/(?:[a-z]+\/)?(\d{4})\/([a-z0-9]{2,16})(?:[/?#]|$)/);
  if (first) return first[2] === "team" ? null : `${first[1]}${first[2]}`;
  const m = s.match(/(\d{4}[a-z0-9]{2,16})(?:[/?#]|$)/);
  return m && EVENT_KEY.test(m[1]) ? m[1] : null;
}

export const links = {
  tbaTeam:     (team: number, year?: number) => `https://www.thebluealliance.com/team/${team}${year ? `/${year}` : ""}`,
  tbaEvent:    (event: string) => `https://www.thebluealliance.com/event/${event}`,
  tbaMatch:    (match: string) => `https://www.thebluealliance.com/match/${match}`,
  match13Team: (team: number, year?: number) => `https://www.match13.com/team/${team}${year ? `?year=${year}` : ""}`,
  match13Event: (event: string) => `https://www.match13.com/event/${event}`,
  match13Match: (match: string) => `https://www.match13.com/match/${match}`,
  nexusEvent:  (event: string) => `https://frc.nexus/en/event/${event}`,
  /** FIRST's own results site: /{year}/{EVENTCODE} */
  firstEvent:  (event: string) => `https://frc-events.firstinspires.org/${event.slice(0, 4)}/${event.slice(4).toUpperCase()}`,
};
