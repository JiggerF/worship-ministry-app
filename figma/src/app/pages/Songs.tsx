import { useState } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, Filter, Edit, Upload, ExternalLink, Book, Music, X } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string;
  status: "Approved" | "New Song - Learning" | "Approved - Not God";
  keys: string[]; // Can have up to 2 keys
  category: string;
  videoLink: string;
  scriptureAnchor: string;
  chordChartUrl?: string;
}

// Mock data based on spreadsheet
const mockSongs: Song[] = [
  {
    id: "1",
    title: "Above All",
    artist: "Michael Smith",
    status: "Approved",
    keys: ["C"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "2",
    title: "All I Have Is Christ",
    artist: "Sovereign Grace Music",
    status: "New Song - Learning",
    keys: ["C"],
    category: "Assurance of Grace",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Romans 3:4, Ephesians 2:1-10, and Titus 3:3-7",
    chordChartUrl: ""
  },
  {
    id: "3",
    title: "All My Hope Is in Jesus the Solid King",
    artist: "Sovereign Grace Music",
    status: "Approved",
    keys: ["B"],
    category: "Call to Worship",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Psalm 46:1-49, Revelation 5:9",
    chordChartUrl: ""
  },
  {
    id: "4",
    title: "Ancient of Days/Open the Eyes of my Heart",
    artist: "Called Out Music",
    status: "Approved",
    keys: ["B"],
    category: "",
    videoLink: "https://docs.google.com/document",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "5",
    title: "Awesome O",
    artist: "Michael Smith",
    status: "Approved",
    keys: ["C"],
    category: "",
    videoLink: "https://docs.google.com/document",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "6",
    title: "Be With You",
    artist: "Sandy Skoglund, Olly Harvest",
    status: "Approved",
    keys: [],
    category: "",
    videoLink: "",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "7",
    title: "Breathe + Holy and Anointed One",
    artist: "Passion Music",
    status: "Approved",
    keys: ["D"],
    category: "",
    videoLink: "https://docs.google.com/document",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "8",
    title: "Christ Alone",
    artist: "Brian Littrell",
    status: "Approved",
    keys: [],
    category: "",
    videoLink: "",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "9",
    title: "Come Behold the Wondrous Mystery",
    artist: "Keith & Kristyn Getty, Matt Boswell, Matt Papa",
    status: "New Song - Learning",
    keys: [],
    category: "Gospel / Salvation",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Come Behold th..., Colossians 2:2-15, 1 Timothy 3:16",
    chordChartUrl: ""
  },
  {
    id: "10",
    title: "Endless Praise",
    artist: "Charity Gayle",
    status: "Approved",
    keys: ["Gb"],
    category: "",
    videoLink: "https://docs.google.com/document",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "11",
    title: "God So Loved",
    artist: "We The Kingdom",
    status: "Approved",
    keys: ["B"],
    category: "Call to Worship",
    videoLink: "",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "12",
    title: "Hallelujah Here Below",
    artist: "Elevation Worship",
    status: "Approved",
    keys: ["G"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "13",
    title: "Heart of Worship + You are My All in All",
    artist: "Steven Mccluranza",
    status: "Approved",
    keys: ["D"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "14",
    title: "Here I am to Worship",
    artist: "MBL Worship",
    status: "Approved",
    keys: ["D"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "15",
    title: "His Mercy Is More",
    artist: "Sovereign Grace Music",
    status: "New Song - Learning",
    keys: [],
    category: "Confession / Repentance",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "His Mercy Is Mo..., Psalm 103:8-12, Lamentations 3:22-23",
    chordChartUrl: ""
  },
  {
    id: "16",
    title: "House of the Lord",
    artist: "Phil Wickham",
    status: "Approved",
    keys: ["Bb"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "17",
    title: "How Deep The Fathers Love",
    artist: "Austin Stone Worship",
    status: "New Song - Learning",
    keys: [],
    category: "Gospel / Salvation, Thanksgiving",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "How Deep the F..., Romans 5:6-11, Isaiah 53",
    chordChartUrl: ""
  },
  {
    id: "18",
    title: "How Great is Our God",
    artist: "Chris Tomlin",
    status: "Approved",
    keys: ["G"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  },
  {
    id: "19",
    title: "How Great is Our God",
    artist: "Josie Buchanan",
    status: "Approved",
    keys: ["Gb"],
    category: "",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "",
    chordChartUrl: ""
  }
];

const statusOptions = ["Approved", "New Song - Learning", "Approved - Not God"];
const categoryOptions = [
  "Assurance of Grace",
  "Call to Worship",
  "Gospel / Salvation",
  "Confession / Repentance",
  "Thanksgiving"
];

function SongCard({ song, onEdit }: { song: Song; onEdit: (song: Song) => void }) {
  const [uploadingChart, setUploadingChart] = useState(false);

  const handleUploadChart = () => {
    setUploadingChart(true);
    // Simulate upload
    setTimeout(() => {
      setUploadingChart(false);
      alert("Chord chart uploaded successfully!");
    }, 1500);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold leading-tight">{song.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{song.artist}</p>
          </div>
          <Badge
            variant={song.status === "Approved" ? "default" : "secondary"}
            className={song.status === "Approved" ? "bg-green-600" : song.status === "New Song - Learning" ? "bg-yellow-600" : ""}
          >
            {song.status === "New Song - Learning" ? "Learning" : song.status === "Approved - Not God" ? "Not God" : "Approved"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Keys */}
        {song.keys.length > 0 && (
          <div className="flex items-center gap-2">
            <Music className="size-3.5 text-muted-foreground" />
            <div className="flex gap-1.5">
              {song.keys.map((key, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  Key: {key}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Category */}
        {song.category && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">{song.category}</div>
          </div>
        )}

        {/* Scripture */}
        {song.scriptureAnchor && (
          <div className="flex items-start gap-2">
            <Book className="size-3.5 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground flex-1">{song.scriptureAnchor}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(song)}
          >
            <Edit className="size-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleUploadChart}
            disabled={uploadingChart}
          >
            <Upload className="size-3.5 mr-1.5" />
            {uploadingChart ? "Uploading..." : "Chart"}
          </Button>
          {song.videoLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(song.videoLink, "_blank")}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditSongDialog({ song, open, onOpenChange }: { song: Song | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [formData, setFormData] = useState<Song | null>(song);

  const handleSave = () => {
    // Save logic here
    alert("Song updated successfully!");
    onOpenChange(false);
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Song</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Artist */}
          <div>
            <Label htmlFor="artist">Artist/Hymn</Label>
            <Input
              id="artist"
              value={formData.artist}
              onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keys */}
          <div>
            <Label>Keys (up to 2)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Key 1 (e.g., C)"
                value={formData.keys[0] || ""}
                onChange={(e) => {
                  const newKeys = [...formData.keys];
                  newKeys[0] = e.target.value;
                  setFormData({ ...formData, keys: newKeys.filter(k => k) });
                }}
              />
              <Input
                placeholder="Key 2 (optional)"
                value={formData.keys[1] || ""}
                onChange={(e) => {
                  const newKeys = [...formData.keys];
                  newKeys[1] = e.target.value;
                  setFormData({ ...formData, keys: newKeys.filter(k => k) });
                }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Gospel / Salvation"
            />
          </div>

          {/* Video Link */}
          <div>
            <Label htmlFor="videoLink">Video Link</Label>
            <Input
              id="videoLink"
              type="url"
              value={formData.videoLink}
              onChange={(e) => setFormData({ ...formData, videoLink: e.target.value })}
              placeholder="https://youtube.com/..."
            />
          </div>

          {/* Scripture */}
          <div>
            <Label htmlFor="scripture">Scripture Anchor</Label>
            <Input
              id="scripture"
              value={formData.scriptureAnchor}
              onChange={(e) => setFormData({ ...formData, scriptureAnchor: e.target.value })}
              placeholder="e.g., Romans 5:6-11, Isaiah 53"
            />
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Songs() {
  const [songs, setSongs] = useState(mockSongs);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Filter songs
  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      searchQuery === "" ||
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || song.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || song.category.includes(categoryFilter);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleEditSong = (song: Song) => {
    setEditingSong(song);
    setEditDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-6 border-b bg-card">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Song Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage worship songs & chord charts</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search songs or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Filters:</span>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[120px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "New Song - Learning" ? "Learning" : status === "Approved - Not God" ? "Not God" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {(statusFilter !== "all" || categoryFilter !== "all" || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setStatusFilter("all");
                setCategoryFilter("all");
                setSearchQuery("");
              }}
            >
              <X className="size-3" />
              Clear
            </Button>
          )}
        </div>

        {/* Results Count */}
        <div className="text-xs text-muted-foreground">
          Showing {filteredSongs.length} of {songs.length} songs
        </div>

        {/* Song List */}
        <div className="space-y-3">
          {filteredSongs.map((song) => (
            <SongCard key={song.id} song={song} onEdit={handleEditSong} />
          ))}
        </div>

        {filteredSongs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="size-12 mx-auto mb-3 opacity-20" />
            <p>No songs found</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditSongDialog
        song={editingSong}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
