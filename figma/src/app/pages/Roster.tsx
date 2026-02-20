import { useState } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Calendar, Music, Download, User, ChevronRight } from "lucide-react";

interface Musician {
  name: string;
  role: string;
}

interface Song {
  title: string;
  artist: string;
  key: string;
}

interface ServiceRoster {
  date: string;
  status: "DRAFT" | "FINAL";
  team: Musician[];
  songs: Song[];
  chartsPdfUrl: string;
}

// Mock data for February 2026
const februaryRosters: ServiceRoster[] = [
  {
    date: "2026-02-01",
    status: "FINAL",
    team: [
      { name: "Sarah Johnson", role: "Backup Vocals" },
      { name: "David Chen", role: "Acoustic Guitar" },
      { name: "Emily Rodriguez", role: "Keys" },
      { name: "Michael Thompson", role: "Drums" },
      { name: "Chris Martinez", role: "Bass" }
    ],
    songs: [
      { title: "Way Maker", artist: "Sinach", key: "C" },
      { title: "Goodness of God", artist: "Bethel Music", key: "G" },
      { title: "What A Beautiful Name", artist: "Hillsong Worship", key: "D" }
    ],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-02-08",
    status: "FINAL",
    team: [
      { name: "Jessica Lee", role: "Backup Vocals" },
      { name: "Sarah Johnson", role: "Electric Guitar" },
      { name: "Emily Rodriguez", role: "Keys" },
      { name: "Michael Thompson", role: "Drums" },
      { name: "David Chen", role: "Acoustic Guitar" }
    ],
    songs: [
      { title: "Oceans", artist: "Hillsong United", key: "D" },
      { title: "Reckless Love", artist: "Cory Asbury", key: "C" },
      { title: "Great Are You Lord", artist: "All Sons & Daughters", key: "G" }
    ],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-02-15",
    status: "FINAL",
    team: [
      { name: "David Chen", role: "Acoustic Guitar" },
      { name: "Sarah Johnson", role: "Backup Vocals" },
      { name: "Emily Rodriguez", role: "Keys" },
      { name: "Michael Thompson", role: "Drums" },
      { name: "Chris Martinez", role: "Bass" }
    ],
    songs: [
      { title: "How Great Is Our God", artist: "Chris Tomlin", key: "C" },
      { title: "10,000 Reasons", artist: "Matt Redman", key: "G" },
      { title: "Build My Life", artist: "Pat Barrett", key: "D" }
    ],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-02-22",
    status: "FINAL",
    team: [
      { name: "Jessica Lee", role: "Backup Vocals" },
      { name: "David Chen", role: "Electric Guitar" },
      { name: "Emily Rodriguez", role: "Keys" },
      { name: "Michael Thompson", role: "Drums" },
      { name: "Sarah Johnson", role: "Acoustic Guitar" }
    ],
    songs: [
      { title: "Cornerstone", artist: "Hillsong Worship", key: "C" },
      { title: "King of Kings", artist: "Hillsong Worship", key: "A" },
      { title: "The Blessing", artist: "Kari Jobe", key: "G" }
    ],
    chartsPdfUrl: "#"
  }
];

// Mock data for March 2026 (DRAFT)
const marchRosters: ServiceRoster[] = [
  {
    date: "2026-03-01",
    status: "DRAFT",
    team: [
      { name: "Sarah Johnson", role: "Backup Vocals" },
      { name: "David Chen", role: "Acoustic Guitar" },
      { name: "Emily Rodriguez", role: "Keys" },
      { name: "Michael Thompson", role: "Drums" }
    ],
    songs: [
      { title: "Graves Into Gardens", artist: "Elevation Worship", key: "E" },
      { title: "Jireh", artist: "Elevation Worship", key: "D" },
      { title: "Goodness of God", artist: "Bethel Music", key: "G" }
    ],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-03-08",
    status: "DRAFT",
    team: [
      { name: "Jessica Lee", role: "Backup Vocals" },
      { name: "David Chen", role: "Electric Guitar" },
      { name: "Emily Rodriguez", role: "Keys" }
    ],
    songs: [
      { title: "Lion and the Lamb", artist: "Bethel Music", key: "F" },
      { title: "Yes I Will", artist: "Vertical Worship", key: "C" },
      { title: "Christ Be Magnified", artist: "Cody Carnes", key: "G" }
    ],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-03-15",
    status: "DRAFT",
    team: [
      { name: "Sarah Johnson", role: "Backup Vocals" },
      { name: "Chris Martinez", role: "Bass" }
    ],
    songs: [
      { title: "Here Again", artist: "Elevation Worship", key: "D" },
      { title: "Promises", artist: "Maverick City Music", key: "C" },
      { title: "Worthy Of It All", artist: "David Brymer", key: "E" }
    ],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-03-22",
    status: "DRAFT",
    team: [],
    songs: [],
    chartsPdfUrl: "#"
  },
  {
    date: "2026-03-29",
    status: "DRAFT",
    team: [],
    songs: [],
    chartsPdfUrl: "#"
  }
];

function RosterCard({ roster, isUpcoming }: { roster: ServiceRoster; isUpcoming?: boolean }) {
  const date = new Date(roster.date);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-US', { 
    day: '2-digit', 
    month: 'short',
    year: 'numeric' 
  });

  const isEmpty = roster.team.length === 0;

  // Group team members by role for better clarity
  const groupedByRole = roster.team.reduce((acc, musician) => {
    if (!acc[musician.role]) {
      acc[musician.role] = [];
    }
    acc[musician.role].push(musician.name);
    return acc;
  }, {} as Record<string, string[]>);

  // Role abbreviations for compact display
  const roleAbbrev: Record<string, string> = {
    "Backup Vocals": "VOC",
    "Acoustic Guitar": "AG",
    "Electric Guitar": "EG",
    "Keys": "KEYS",
    "Bass": "BASS",
    "Drums": "DRM"
  };

  return (
    <Card className={`${isEmpty ? "opacity-60" : ""} ${isUpcoming ? "border-primary border-2" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isUpcoming && (
              <div className="text-xs text-primary font-medium mb-1">This Week</div>
            )}
            <div className="text-xl font-semibold">{dayName}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{dateStr}</div>
          </div>
          <Badge 
            variant={roster.status === "FINAL" ? "default" : "secondary"}
            className={roster.status === "FINAL" ? "bg-green-600" : ""}
          >
            {roster.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Roster not yet assigned
          </p>
        ) : (
          <>
            {/* Team Roster - Compact Display */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <User className="size-3.5" />
                <span>Team</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(groupedByRole).map(([role, names]) => (
                  <div key={role} className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-medium text-muted-foreground min-w-[3rem]">
                      {roleAbbrev[role] || role}
                    </span>
                    <span className="flex-1">{names.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Songs */}
            {roster.songs.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Music className="size-3.5" />
                  <span>Songs</span>
                </div>
                <div className="space-y-1">
                  {roster.songs.map((song, idx) => (
                    <div key={idx} className="flex items-baseline gap-1.5 text-sm">
                      <span className="text-muted-foreground text-xs min-w-[1rem]">{idx + 1}.</span>
                      <div className="flex-1">
                        <span>{song.title}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">
                          ({song.key})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download PDF */}
            {roster.songs.length > 0 && (
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={() => window.open(roster.chartsPdfUrl, '_blank')}
              >
                <Download className="size-4 mr-2" />
                Download Chord Charts
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Roster() {
  // Helper to check if a date is in the current week
  const isCurrentWeek = (date: Date) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Go to Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return date >= startOfWeek && date <= endOfWeek;
  };

  // Determine which month to show by default and which service is current week
  const today = new Date();
  const allRosters = [...februaryRosters, ...marchRosters];
  
  // Find the service in current week, or next upcoming if current week has passed
  const currentWeekRoster = allRosters.find(r => isCurrentWeek(new Date(r.date)));
  const upcomingRoster = currentWeekRoster || allRosters.find(r => new Date(r.date) >= today);
  
  const upcomingMonth = upcomingRoster 
    ? new Date(upcomingRoster.date).getMonth() === 1 ? "february" : "march"
    : "february";
  
  const [activeMonth, setActiveMonth] = useState(upcomingMonth);

  // Sort rosters: current week first, then upcoming, then past
  const sortRosters = (rosters: ServiceRoster[]) => {
    return [...rosters].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const isCurrentA = isCurrentWeek(dateA);
      const isCurrentB = isCurrentWeek(dateB);
      
      // Current week always first
      if (isCurrentA && !isCurrentB) return -1;
      if (!isCurrentA && isCurrentB) return 1;
      
      // Otherwise chronological order
      return dateA.getTime() - dateB.getTime();
    });
  };

  const sortedFebruaryRosters = sortRosters(februaryRosters);
  const sortedMarchRosters = sortRosters(marchRosters);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-6 border-b bg-card">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">WCC Worship Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Service Roster Schedule</p>
        </div>
      </div>

      {/* Month Tabs */}
      <div className="px-4 pt-4">
        <Tabs value={activeMonth} onValueChange={setActiveMonth} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="february">February 2026</TabsTrigger>
            <TabsTrigger value="march">March 2026</TabsTrigger>
          </TabsList>

          <TabsContent value="february" className="mt-4 space-y-4 pb-6">
            {sortedFebruaryRosters.map((roster) => (
              <RosterCard 
                key={roster.date} 
                roster={roster}
                isUpcoming={upcomingRoster?.date === roster.date}
              />
            ))}
          </TabsContent>

          <TabsContent value="march" className="mt-4 space-y-4 pb-6">
            {sortedMarchRosters.map((roster) => (
              <RosterCard 
                key={roster.date} 
                roster={roster}
                isUpcoming={upcomingRoster?.date === roster.date}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
