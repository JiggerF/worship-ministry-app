import { useState, useMemo } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Music,
} from "lucide-react";

interface SongData {
  id: string;
  title: string;
  artist: string;
  status: "Approved" | "New Song - Learning";
  keyVersion1: string;
  keyVersion2?: string;
  category: string;
  videoLink?: string;
  scriptureAnchor?: string;
  chordChartUrl?: string;
  lastUpdated: string;
}

// Mock data based on the spreadsheet
const mockSongs: SongData[] = [
  {
    id: "1",
    title: "Above All",
    artist: "Michael Smith",
    status: "Approved",
    keyVersion1: "B",
    category: "Assurance of Grace",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Romans 3:8, Ephesians 2:1-10, Titus 3:3-7",
    chordChartUrl: "#",
    lastUpdated: "2026-02-15",
  },
  {
    id: "2",
    title: "All Things In Christ",
    artist: "Sovereign Grace Music",
    status: "New Song - Learning",
    keyVersion1: "G",
    category: "Gospel/Salvation",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "All I Have is Christ",
    chordChartUrl: "#",
    lastUpdated: "2026-02-10",
  },
  {
    id: "3",
    title: "Ancient of Days/Open the Eyes of my Heart",
    artist: "Called Out Music",
    status: "Approved",
    keyVersion1: "B",
    keyVersion2: "C",
    category: "Call to Worship",
    videoLink: "https://docs.google.com",
    scriptureAnchor: "Praise/Worship",
    chordChartUrl: "#",
    lastUpdated: "2026-02-12",
  },
  {
    id: "4",
    title: "Awesome is He",
    artist: "Michael Smith",
    status: "Approved",
    keyVersion1: "C",
    category: "Call to Worship",
    videoLink: "https://docs.google.com",
    chordChartUrl: "#",
    lastUpdated: "2026-02-08",
  },
  {
    id: "5",
    title: "Be With You",
    artist: "Sandy Stepayne, Olly Harvest",
    status: "Approved",
    keyVersion1: "G",
    category: "Assurance of Grace",
    videoLink: "https://www.youtube.com",
    chordChartUrl: "#",
    lastUpdated: "2026-02-05",
  },
  {
    id: "6",
    title: "Breathe + Holy and Anointed One",
    artist: "Passion Music",
    status: "Approved",
    keyVersion1: "C",
    keyVersion2: "D",
    category: "Confession/Repentance",
    videoLink: "https://docs.google.com",
    scriptureAnchor: "Psalm 100:8-12, Lamentations 3:22-23",
    chordChartUrl: "#",
    lastUpdated: "2026-02-01",
  },
  {
    id: "7",
    title: "Christ Alone",
    artist: "Brian Littrell",
    status: "Approved",
    keyVersion1: "G",
    category: "Gospel/Salvation",
    videoLink: "https://www.youtube.com",
    chordChartUrl: "#",
    lastUpdated: "2026-01-28",
  },
  {
    id: "8",
    title: "Come Behold the Wondrous Mystery",
    artist: "Keith & Kristyn Getty, Matt Boswell, Matt Papa",
    status: "Approved",
    keyVersion1: "D",
    category: "Gospel/Salvation",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Come Behold the Wondrous Mystery",
    chordChartUrl: "#",
    lastUpdated: "2026-01-25",
  },
  {
    id: "9",
    title: "Way Maker",
    artist: "Sinach",
    status: "Approved",
    keyVersion1: "C",
    keyVersion2: "D",
    category: "Praise/Worship",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Psalm 77:19",
    chordChartUrl: "#",
    lastUpdated: "2026-02-14",
  },
  {
    id: "10",
    title: "Goodness of God",
    artist: "Bethel Music",
    status: "Approved",
    keyVersion1: "G",
    category: "Thanksgiving",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "Psalm 107:1",
    chordChartUrl: "#",
    lastUpdated: "2026-02-13",
  },
  {
    id: "11",
    title: "How Great Is Our God",
    artist: "Chris Tomlin",
    status: "Approved",
    keyVersion1: "C",
    keyVersion2: "G",
    category: "Praise/Worship",
    videoLink: "https://www.youtube.com",
    chordChartUrl: "#",
    lastUpdated: "2026-02-11",
  },
  {
    id: "12",
    title: "Build My Life",
    artist: "Pat Barrett",
    status: "New Song - Learning",
    keyVersion1: "D",
    category: "Call to Worship",
    videoLink: "https://www.youtube.com",
    scriptureAnchor: "1 Corinthians 3:11",
    chordChartUrl: "#",
    lastUpdated: "2026-02-09",
  },
];

const categories = [
  "All Categories",
  "Assurance of Grace",
  "Call to Worship",
  "Confession/Repentance",
  "Gospel/Salvation",
  "Praise/Worship",
  "Thanksgiving",
];

const statuses = ["All Statuses", "Approved", "New Song - Learning"];

const ITEMS_PER_PAGE = 15;

export default function AdminSongs() {
  const [songs, setSongs] = useState<SongData[]>(mockSongs);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [sortField, setSortField] = useState<keyof SongData>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [deletingSong, setDeletingSong] = useState<SongData | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<SongData>>({
    title: "",
    artist: "",
    status: "Approved",
    keyVersion1: "",
    keyVersion2: "",
    category: "",
    videoLink: "",
    scriptureAnchor: "",
  });

  // Filter and search
  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        filterCategory === "All Categories" || song.category === filterCategory;
      const matchesStatus =
        filterStatus === "All Statuses" || song.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [songs, searchQuery, filterCategory, filterStatus]);

  // Sort
  const sortedSongs = useMemo(() => {
    return [...filteredSongs].sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [filteredSongs, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedSongs.length / ITEMS_PER_PAGE);
  const paginatedSongs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedSongs.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedSongs, currentPage]);

  const handleSort = (field: keyof SongData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleAddSong = () => {
    setEditingSong(null);
    setFormData({
      title: "",
      artist: "",
      status: "Approved",
      keyVersion1: "",
      keyVersion2: "",
      category: "",
      videoLink: "",
      scriptureAnchor: "",
    });
    setIsAddEditOpen(true);
  };

  const handleEditSong = (song: SongData) => {
    setEditingSong(song);
    setFormData(song);
    setIsAddEditOpen(true);
  };

  const handleDeleteSong = (song: SongData) => {
    setDeletingSong(song);
    setIsDeleteOpen(true);
  };

  const handleSaveSong = () => {
    if (editingSong) {
      setSongs(
        songs.map((s) =>
          s.id === editingSong.id
            ? {
                ...formData,
                id: editingSong.id,
                lastUpdated: new Date().toISOString().split("T")[0],
              } as SongData
            : s
        )
      );
    } else {
      const newSong: SongData = {
        ...formData,
        id: Date.now().toString(),
        lastUpdated: new Date().toISOString().split("T")[0],
      } as SongData;
      setSongs([newSong, ...songs]);
    }
    setIsAddEditOpen(false);
  };

  const confirmDelete = () => {
    if (deletingSong) {
      setSongs(songs.filter((s) => s.id !== deletingSong.id));
      setIsDeleteOpen(false);
      setDeletingSong(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("All Categories");
    setFilterStatus("All Statuses");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    filterCategory !== "All Categories" ||
    filterStatus !== "All Statuses";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Song Library</h1>
            <p className="text-muted-foreground mt-1">
              Manage worship songs and chord charts
            </p>
          </div>
          <Button onClick={handleAddSong} size="lg">
            <Plus className="size-4 mr-2" />
            Add Song
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or artist..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Category Filter */}
              <Select
                value={filterCategory}
                onValueChange={(value) => {
                  setFilterCategory(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={filterStatus}
                onValueChange={(value) => {
                  setFilterStatus(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="size-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            {/* Results Summary */}
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Showing {paginatedSongs.length} of {filteredSongs.length} songs
              </span>
              {totalPages > 1 && (
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("title")}
                        className="h-8 px-2"
                      >
                        Title
                        <ArrowUpDown className="ml-2 size-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[200px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("artist")}
                        className="h-8 px-2"
                      >
                        Artist
                        <ArrowUpDown className="ml-2 size-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[120px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("status")}
                        className="h-8 px-2"
                      >
                        Status
                        <ArrowUpDown className="ml-2 size-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[100px]">Keys</TableHead>
                    <TableHead className="w-[180px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("category")}
                        className="h-8 px-2"
                      >
                        Category
                        <ArrowUpDown className="ml-2 size-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[200px]">Scripture</TableHead>
                    <TableHead className="w-[150px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSongs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Music className="size-8 mb-2" />
                          <p>No songs found</p>
                          {hasActiveFilters && (
                            <Button
                              variant="link"
                              onClick={clearFilters}
                              className="mt-2"
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSongs.map((song) => (
                      <TableRow key={song.id}>
                        <TableCell className="font-medium">{song.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {song.artist}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              song.status === "Approved" ? "default" : "secondary"
                            }
                            className={
                              song.status === "Approved" ? "bg-green-600" : ""
                            }
                          >
                            {song.status === "Approved" ? "Approved" : "Learning"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {song.keyVersion1}
                            {song.keyVersion2 && ` / ${song.keyVersion2}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {song.category}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {song.scriptureAnchor || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {song.videoLink && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(song.videoLink, "_blank")}
                              >
                                <ExternalLink className="size-4" />
                              </Button>
                            )}
                            {song.chordChartUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(song.chordChartUrl, "_blank")
                                }
                              >
                                <Download className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSong(song)}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSong(song)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-4 mr-2" />
              Previous
            </Button>
            <div className="flex items-center gap-2 px-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="size-4 ml-2" />
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSong ? "Edit Song" : "Add New Song"}
            </DialogTitle>
            <DialogDescription>
              {editingSong
                ? "Update song information and chord charts"
                : "Add a new song to the worship library"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Title */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="title">Song Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Way Maker"
              />
            </div>

            {/* Artist */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="artist">Artist/Hymn *</Label>
              <Input
                id="artist"
                value={formData.artist}
                onChange={(e) =>
                  setFormData({ ...formData, artist: e.target.value })
                }
                placeholder="e.g., Sinach"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "Approved" | "New Song - Learning") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="New Song - Learning">
                    New Song - Learning
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.slice(1).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keys */}
            <div className="space-y-2">
              <Label htmlFor="keyVersion1">Key (Version 1) *</Label>
              <Input
                id="keyVersion1"
                value={formData.keyVersion1}
                onChange={(e) =>
                  setFormData({ ...formData, keyVersion1: e.target.value })
                }
                placeholder="e.g., C"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyVersion2">Key (Version 2)</Label>
              <Input
                id="keyVersion2"
                value={formData.keyVersion2}
                onChange={(e) =>
                  setFormData({ ...formData, keyVersion2: e.target.value })
                }
                placeholder="e.g., D"
              />
            </div>

            {/* Video Link */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="videoLink">Video Link</Label>
              <Input
                id="videoLink"
                value={formData.videoLink}
                onChange={(e) =>
                  setFormData({ ...formData, videoLink: e.target.value })
                }
                placeholder="https://www.youtube.com/..."
              />
            </div>

            {/* Scripture Anchor */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="scriptureAnchor">Scripture Anchor</Label>
              <Textarea
                id="scriptureAnchor"
                value={formData.scriptureAnchor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    scriptureAnchor: e.target.value,
                  })
                }
                placeholder="e.g., Romans 3:8, Ephesians 2:1-10"
                rows={3}
              />
            </div>

            {/* Chord Chart Upload */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="chordChart">Chord Chart</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="chordChart"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="flex-1"
                />
                <Button variant="outline" type="button">
                  <Upload className="size-4 mr-2" />
                  Upload
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload PDF or Word document (Max 5MB)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddEditOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSong}>
              {editingSong ? "Update Song" : "Add Song"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Song?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSong?.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
