# WCC Worship Team Admin Songs Page - Design Specification

## Overview
An admin interface for worship team leaders to manage the song library, including adding, editing, deleting songs, uploading chord charts, and organizing the worship repertoire. This follows the same mobile-first UX principles as the Roster page.

## Context & Purpose
- **Admin-only interface** for worship team leaders/coordinators
- **Song library management** for a rolling worship catalog
- **Chord chart repository** for musicians
- **Learning tracking** to distinguish approved songs from new songs being learned
- **Multi-key support** for flexible vocal ranges (up to 2 key versions per song)

## Data Structure

```typescript
interface SongData {
  id: string;
  title: string;              // Song name
  artist: string;             // Artist/Hymn writer
  status: "Approved" | "New Song - Learning";
  keyVersion1: string;        // Primary key (e.g., "C", "G", "D")
  keyVersion2?: string;       // Optional alternate key
  category: string;           // Song category/theme
  videoLink?: string;         // YouTube or video URL
  scriptureAnchor?: string;   // Bible references
  chordChartUrl?: string;     // PDF/document URL
  lastUpdated: string;        // ISO date string
}
```

## Categories
Based on worship context:
- **Assurance of Grace**
- **Call to Worship**
- **Confession/Repentance**
- **Gospel/Salvation**
- **Praise/Worship**
- **Thanksgiving**

## Core Features

### 1. Search & Filter
- **Search bar**: Real-time search by song title or artist
- **Category filter**: Dropdown to filter by category
- **Status filter**: Dropdown to filter by Approved vs New Song - Learning
- **Clear filters button**: Reset all filters with one click (only shows when filters active)
- **Results counter**: "Showing X of Y songs"

### 2. Sorting & Pagination
- **Sortable fields**: Title, Artist, Status, Category, Last Updated
- **Sort direction**: Toggle ascending/descending
- **Pagination**: 10 songs per page
- **Page navigation**: Previous/Next buttons with current page indicator

### 3. CRUD Operations

#### Add Song
- Button in header: "+ Add Song"
- Opens dialog/modal with form
- Required fields: Title, Artist, Status, Key Version 1, Category
- Optional fields: Key Version 2, Video Link, Scripture Anchor

#### Edit Song
- Edit button on each song card
- Opens same dialog/modal pre-filled with existing data
- Updates lastUpdated timestamp on save

#### Delete Song
- Delete button on each song card (red trash icon)
- Confirmation dialog: "Are you sure you want to delete [Title]?"
- Permanent deletion (no undo)

#### Upload Chord Chart
- File input in Add/Edit dialog
- Accept: PDF, DOC, DOCX files
- Upload button to process file
- Display download link once uploaded

### 4. Bulk Operations (Optional Enhancement)
- Checkbox selection for multiple songs
- Bulk actions: Change status, Delete selected, Export list
- Keep implementation simple

## UI Components & Layout

### Header (Sticky)
```
Song Library                    [+ Add Song]
Manage worship songs and chord charts
```
- Sticky positioning at top
- Add Song button (primary action)
- Simple, clean header

### Search & Filter Card
```
[🔍 Search by title or artist...]

[Category Dropdown]  [Status Dropdown]

[✕ Clear Filters]  (only shows if filters active)
```
- Compact card design
- Grid layout for filter dropdowns (2 columns on mobile)
- Search icon inside input field

### Song Cards (Mobile-First)

#### Card Header
- **Song Title**: Bold, truncated if too long
- **Artist**: Small muted text below title
- **Status Badge**: Right-aligned
  - Approved: Green badge
  - New Song - Learning: Gray badge (abbreviated to "Learning")

#### Card Content
**Grid Layout (2 columns):**
```
Keys: C / D          Category: Call to Worship
Scripture: Romans 3:8, Ephesians 2:1-10
```

**Action Buttons (Bottom row):**
```
[Video] [Chart] [Edit] [Delete]
```
- Video & Chart: Only show if URLs exist
- Edit: Outline button with edit icon
- Delete: Outline button with red trash icon
- Compact sizing for mobile

### Empty State
```
[🎵 Music Icon]
No songs found

[Clear filters] (if filters active)
```

### Pagination Controls
```
[← Prev]  Page X / Y  [Next →]
```
- Centered at bottom
- Disabled state for first/last page
- Simple, clear navigation

## Add/Edit Dialog

### Dialog Layout
```
[Dialog Title: "Add New Song" or "Edit Song"]
Subtitle description

[Form Fields - Scrollable Content]

[Cancel] [Save Button]
```

### Form Fields (Top to Bottom)

1. **Song Title** (required)
   - Input field
   - Placeholder: "e.g., Way Maker"

2. **Artist/Hymn** (required)
   - Input field
   - Placeholder: "e.g., Sinach"

3. **Status** (required)
   - Dropdown: Approved | New Song - Learning
   - Default: Approved

4. **Keys** (2-column grid)
   - **Key (Version 1)** (required)
     - Input field
     - Placeholder: "e.g., C"
   - **Key (Version 2)** (optional)
     - Input field
     - Placeholder: "e.g., D"

5. **Category** (required)
   - Dropdown with all categories
   - No default selection

6. **Video Link** (optional)
   - Input field
   - Placeholder: "https://www.youtube.com/..."

7. **Scripture Anchor** (optional)
   - Textarea (3 rows)
   - Placeholder: "e.g., Romans 3:8, Ephesians 2:1-10"

8. **Chord Chart** (optional)
   - File input + Upload button
   - Accept: .pdf, .doc, .docx
   - Helper text: "Upload PDF or Word document"

### Validation
- Required fields must be filled before saving
- Show error messages inline
- Video Link: Basic URL validation (optional)
- Keys: Allow standard music keys (A-G with #/b modifiers)

## Delete Confirmation Dialog

```
Delete Song?

Are you sure you want to delete "[Song Title]"? 
This action cannot be undone.

[Cancel] [Delete]
```
- Alert dialog (modal)
- Delete button in destructive red color
- Clear warning about permanent deletion

## Responsive Design

### Mobile (Primary)
- Card-based layout
- Single column
- Stacked buttons when needed
- Touch-friendly tap targets (min 44px)
- Compact spacing to maximize content

### Tablet/Desktop
- Can upgrade to table view if desired
- Multi-column grid for cards (2-3 columns)
- Larger dialog modals
- More space for content

## Visual Styling

### Typography
- Page title: `text-2xl font-semibold`
- Song title: `font-semibold`
- Artist: `text-sm text-muted-foreground`
- Labels: `text-xs text-muted-foreground`
- Body text: `text-sm`

### Spacing
- Card gaps: `space-y-3` between cards
- Section gaps: `space-y-4`
- Form fields: `space-y-4` vertical spacing
- Content padding: `px-4 py-4`

### Colors
- Approved badge: `bg-green-600`
- Learning badge: `variant="secondary"`
- Delete icon: `text-destructive`
- Muted text: `text-muted-foreground`

### Icons (lucide-react)
- Size: `size-4` for buttons, `size-3.5` for compact areas
- Search: `Search`
- Add: `Plus`
- Edit: `Edit`
- Delete: `Trash2`
- Video: `ExternalLink`
- Chart: `Download`
- Upload: `Upload`
- Music (empty state): `Music`
- Navigation: `ChevronLeft`, `ChevronRight`
- Clear: `X`

## State Management

### Local State (useState)
```typescript
const [songs, setSongs] = useState<SongData[]>([]);
const [searchQuery, setSearchQuery] = useState("");
const [filterCategory, setFilterCategory] = useState("All Categories");
const [filterStatus, setFilterStatus] = useState("All Statuses");
const [sortField, setSortField] = useState<keyof SongData>("title");
const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
const [currentPage, setCurrentPage] = useState(1);
const [isAddEditOpen, setIsAddEditOpen] = useState(false);
const [isDeleteOpen, setIsDeleteOpen] = useState(false);
const [editingSong, setEditingSong] = useState<SongData | null>(null);
const [formData, setFormData] = useState<Partial<SongData>>({});
```

### Computed Values (useMemo)
```typescript
// Filtered songs (search + filters)
const filteredSongs = useMemo(() => {...}, [songs, searchQuery, filterCategory, filterStatus]);

// Sorted songs
const sortedSongs = useMemo(() => {...}, [filteredSongs, sortField, sortDirection]);

// Paginated songs (current page slice)
const paginatedSongs = useMemo(() => {...}, [sortedSongs, currentPage]);
```

## Key User Flows

### Adding a New Song
1. Click "+ Add Song" button in header
2. Dialog opens with empty form
3. Fill in required fields (title, artist, status, key1, category)
4. Optionally add key2, video, scripture, chord chart
5. Click "Add Song" button
6. Dialog closes, new song appears at top of list
7. Success feedback (optional toast notification)

### Editing a Song
1. Click "Edit" button on song card
2. Dialog opens with pre-filled form data
3. Modify any fields
4. Click "Update Song" button
5. Dialog closes, song updates in list
6. lastUpdated timestamp refreshes

### Deleting a Song
1. Click "Delete" button on song card (trash icon)
2. Confirmation dialog appears
3. Read warning message
4. Click "Delete" to confirm or "Cancel" to abort
5. If confirmed, song removed from list immediately

### Searching & Filtering
1. Type in search bar → Results filter in real-time
2. Select category from dropdown → List filters
3. Select status from dropdown → List filters
4. Filters stack (AND logic)
5. Click "Clear Filters" to reset everything

### Uploading Chord Chart
1. In Add/Edit dialog, click file input in "Chord Chart" section
2. System file picker opens
3. Select PDF or Word document
4. Click "Upload" button (or auto-upload on selection)
5. File URL saved to `chordChartUrl` field
6. "Chart" button appears on song card after save

## Advanced Features (Optional)

### Duplicate Song Detection
- Check if song title + artist already exists
- Show warning before adding duplicate
- Allow override if intentional

### Export Song List
- Export filtered/sorted list to CSV
- Include all fields
- Useful for reporting or backup

### Bulk Status Update
- Select multiple songs via checkboxes
- Change status for all selected songs
- Useful when approving multiple new songs

### Song Usage Tracking
- Track how many times song used in rosters
- Display "Last Used" date on card
- Sort by "Most Used" or "Least Used"

### Version History
- Track changes to song data
- View edit history
- Restore previous versions

### Tags/Labels
- Add custom tags beyond categories
- Multi-tag support (e.g., "Christmas", "Easter", "Communion")
- Tag-based filtering

## What NOT to Include
- ❌ No complex table views (mobile-first means cards)
- ❌ No inline editing (use dialog for clarity)
- ❌ No auto-save (explicit save actions)
- ❌ No role-based permissions (admin-only view)
- ❌ No version control (unless optional enhancement)
- ❌ No collaborative editing (single-user edits)

## Dependencies
- React with hooks (useState, useMemo)
- UI components: Card, Badge, Button, Input, Select, Dialog, AlertDialog, Table, Pagination
- Icons: lucide-react
- Form components: Label, Textarea
- Optional: File upload handling library

## Mock Data Example

```typescript
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
    scriptureAnchor: "All I Have is Chr...",
    chordChartUrl: "#",
    lastUpdated: "2026-02-10",
  },
  // ... more songs
];
```

## Integration with Roster Page

### Song Selection in Roster
- When building a roster, admin selects 3 songs from this library
- Filter by status: Show only "Approved" songs by default
- Option to include "Learning" songs for practice services

### Chord Chart Bundling
- When roster is finalized, bundle the 3 selected songs' chord charts
- Generate single PDF containing all 3 charts
- Link from roster page downloads this bundle

### Song Metadata Display
- Song title, key, and artist populate roster cards
- Consistent data between Song Library and Roster views

## Performance Considerations

### Pagination
- Load 10 songs per page (configurable constant)
- Only render visible songs (not entire list)
- Smooth page transitions

### Search/Filter
- Debounce search input (300ms) to avoid excessive re-renders
- Use useMemo for computed filtered/sorted lists
- Reset to page 1 when filters change

### File Uploads
- Show upload progress indicator
- Validate file size (max 5MB recommended)
- Compress PDFs if possible

## Accessibility

- Keyboard navigation support
- Focus management in dialogs
- ARIA labels on icon buttons
- Clear error messages
- High contrast colors
- Touch targets min 44px

## Testing Scenarios

1. **Add song with all fields** → Verify data saves correctly
2. **Add song with only required fields** → Verify optional fields are empty
3. **Edit song and change status** → Verify badge updates
4. **Delete song** → Verify confirmation and removal
5. **Search for partial title** → Verify filtering works
6. **Filter by category + status** → Verify AND logic
7. **Clear filters** → Verify reset to full list
8. **Paginate through 25 songs** → Verify 10 per page, 3 pages
9. **Sort by title A-Z then Z-A** → Verify direction toggle
10. **Upload chord chart** → Verify file handling and download link

## Future Enhancements

- **MIDI/Audio preview**: Play song snippet
- **Setlist builder**: Drag-and-drop song ordering for services
- **Lyrics database**: Store and display lyrics
- **Transposition tool**: Auto-generate charts in different keys
- **Team preferences**: Track which musicians prefer which keys
- **Song statistics**: Usage frequency, average rating
- **Mobile app**: Native iOS/Android version
- **Offline mode**: Download charts for offline access

---

## Implementation Checklist

- [ ] Create SongData interface
- [ ] Set up mock data (8+ songs)
- [ ] Build search & filter UI
- [ ] Implement pagination logic
- [ ] Create song card component
- [ ] Build Add/Edit dialog form
- [ ] Implement delete confirmation
- [ ] Add sort functionality
- [ ] Handle file upload (chord charts)
- [ ] Test all CRUD operations
- [ ] Verify mobile responsiveness
- [ ] Add loading states
- [ ] Add error handling
- [ ] Optimize performance (useMemo)
- [ ] Accessibility review
- [ ] User testing

---

## Design Principles
- **Mobile-first**: Optimize for phone screens
- **Clean & simple**: Avoid complexity, clear actions
- **Consistent UX**: Match Roster page styling
- **Fast interactions**: Immediate feedback, no lag
- **Clear hierarchy**: Important info stands out
- **Touch-friendly**: Large tap targets, easy scrolling
