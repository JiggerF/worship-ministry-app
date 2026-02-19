import type { MemberRole, RosterStatus } from "@/lib/types/database";

type DevAssignment = {
  id: string;
  date: string;
  role: MemberRole;
  status: RosterStatus;
  member: { id: string; name: string } | null;
};

export function makeDevRoster(sundaysIso: string[], lockedDates: string[] = []) {
  const devSet: Record<string, any[]> = {};

  const songPool = [
    { title: "Amazing Grace", key: "G" },
    { title: "How Great Is Our God", key: "D" },
    { title: "In Christ Alone", key: "F" },
    { title: "Blessed Be Your Name", key: "E" },
    { title: "Cornerstone", key: "C" },
    { title: "10,000 Reasons", key: "G" },
  ];

  const assignments: DevAssignment[] = sundaysIso.flatMap((iso, i) => {
    // Determine the Sunday-level status: LOCKED if the iso is in lockedDates, otherwise DRAFT
    const dayStatus: RosterStatus = lockedDates.includes(iso) ? "LOCKED" : "DRAFT";

    const assignmentsForDay: DevAssignment[] = [
      {
        id: `mock-${iso}-worshiplead`,
        date: iso,
        role: "worship_lead",
        status: dayStatus,
        member: { id: `m-${i}-1`, name: ["Tess", "Alona", "Jossel", "Hannah"][i % 4] },
      },
      {
        id: `mock-${iso}-backupvocals1`,
        date: iso,
        role: "backup_vocals_1",
        status: dayStatus,
        member: { id: `m-${i}-2`, name: ["Rose", "Cathy", "Alona", "Rose"][i % 4] },
      },
      {
        id: `mock-${iso}-electricguitar`,
        date: iso,
        role: "electric_guitar",
        status: dayStatus,
        member: { id: `m-${i}-3`, name: ["Jigger", "Tess", "Alona", "Ronald"][i % 4] },
      },
      {
        id: `mock-${iso}-drums`,
        date: iso,
        role: "drums",
        status: dayStatus,
        member: { id: `m-${i}-4`, name: ["Nathan", "John", "Joseph", "Jigger"][i % 4] },
      },
      {
        id: `mock-${iso}-acousticguitar`,
        date: iso,
        role: "acoustic_guitar",
        status: dayStatus,
        member: { id: `m-${i}-5`, name: ["Teng", "Joseph", "Teng", "Teng"][i % 4] },
      },
      {
        id: `mock-${iso}-keyboard`,
        date: iso,
        role: "keyboard",
        status: dayStatus,
        member: { id: `m-${i}-6`, name: ["Ephraim", "Mithi", "Mithi", "Mithi"][i % 4] },
      },
      {
        id: `mock-${iso}-bass`,
        date: iso,
        role: "bass",
        status: dayStatus,
        member: { id: `m-${i}-7`, name: ["Joseph", "Ronald", "Ronald", "Ronald"][i % 4] },
      },
    ];

    // Build a small varied setlist for this Sunday from the song pool
    const start = i % songPool.length;
    const setlistCount = 3;
    devSet[iso] = Array.from({ length: setlistCount }).map((_, idx) => {
      const song = songPool[(start + idx) % songPool.length];
      return {
        id: `song-${iso}-${idx + 1}`,
        position: idx + 1,
        song: { title: song.title, chord_charts: [{ key: song.key }] },
      };
    });

    return assignmentsForDay;
  });

  return { assignments, setlists: devSet };
}

export default makeDevRoster;
