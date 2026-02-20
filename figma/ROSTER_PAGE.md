# WCC Worship Team Roster Page - Design Specification

## Overview
A mobile-first browser application for worship team musicians to view their rostered services. This is a read-only view for team members (non-admin) showing the schedule for a 2-month rolling cycle.

## Context & Workflow
- **Sunday Services Only**: There is only one service per week on Sundays
- **Rolling 2-Month Cycle**: Display current month and next month
- **Status System**:
  - **FINAL**: Current month roster is locked and confirmed
  - **DRAFT**: Next month roster is being finalized, gets locked 2 weeks before month starts
- Musicians can view both current (FINAL) and future (DRAFT) rosters

## Key UX Requirements

### 1. Current Week Priority
- **The current week's Sunday MUST be displayed at the top**
- Auto-sort rosters so current week appears first (no scrolling needed)
- Auto-select the correct month tab containing the current week
- Visual indicators:
  - Blue border (border-2) around the current week's card
  - "This Week" label in blue text above the date
  - Larger date display for easy mobile reading

### 2. Mobile-First Design
- Optimized for mobile browser (not native app)
- Space-efficient layout
- Touch-friendly interface
- Clear typography for small screens

## UI Components

### Header (Sticky)
```
WCC Worship Team
Service Roster Schedule
```
- Sticky positioning
- Simple, centered text
- Border bottom for separation

### Month Tabs
- Two tabs: "February 2026" and "March 2026"
- Grid layout (2 columns)
- Auto-select month containing current week

### Service Cards

#### Card Header
- **Date Display** (large, prominent):
  - Day name in large text (text-xl font-semibold) e.g., "Sunday"
  - Date in smaller muted text e.g., "01 Feb 2026"
- **"This Week" indicator**: Small blue text above date (only for current week)
- **Status Badge**: Right-aligned
  - FINAL: Green badge (bg-green-600)
  - DRAFT: Secondary/gray badge

#### Card Content - Team Section
**Compact display using role abbreviations:**
- VOC = Backup Vocals
- AG = Acoustic Guitar
- EG = Electric Guitar
- KEYS = Keys
- BASS = Bass
- DRM = Drums

**Format:**
```
Team
  VOC    Sarah Johnson, Jessica Lee
  AG     David Chen
  KEYS   Emily Rodriguez
  DRM    Michael Thompson
  BASS   Chris Martinez
```
- Role abbreviations left-aligned (min-width: 3rem)
- Names comma-separated on same line
- Small icons (size-3.5) for visual hierarchy

#### Card Content - Songs Section
**Format:**
```
Songs
  1. Way Maker (C)
  2. Goodness of God (G)
  3. What A Beautiful Name (D)
```
- Song title with key in parentheses
- No artist names (space-saving)
- Compact spacing

#### Download Button
```
[Download Icon] Download Chord Charts
```
- Full-width outline button
- Opens PDF of 3 chord charts bundled together

### Empty State
For unassigned rosters:
```
Roster not yet assigned
```
- Centered, muted text
- Card at 60% opacity

## Data Structure

```typescript
interface Musician {
  name: string;
  role: string; // One of the 6 roles
}

interface Song {
  title: string;
  artist: string; // Not displayed but stored
  key: string;    // e.g., "C", "G", "D"
}

interface ServiceRoster {
  date: string;           // ISO format: "2026-02-01"
  status: "DRAFT" | "FINAL";
  team: Musician[];
  songs: Song[];
  chartsPdfUrl: string;   // Link to PDF bundle
}
```

## Sorting Logic

```javascript
// Current week detection
const isCurrentWeek = (date: Date) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return date >= startOfWeek && date <= endOfWeek;
};

// Sort: current week first, then chronological
const sortRosters = (rosters) => {
  return [...rosters].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const isCurrentA = isCurrentWeek(dateA);
    const isCurrentB = isCurrentWeek(dateB);
    
    if (isCurrentA && !isCurrentB) return -1;
    if (!isCurrentA && isCurrentB) return 1;
    
    return dateA.getTime() - dateB.getTime();
  });
};
```

## Visual Styling Notes

### Current Week Highlight
- Border: `border-primary border-2`
- Label: `text-xs text-primary font-medium`
- No "NEXT" badge or button

### Spacing
- Card spacing: `space-y-4` between cards
- Section spacing: `space-y-3` within cards
- Compact gaps: `gap-1.5` for tight layouts
- Padding: `pb-6` at bottom for scroll clearance

### Typography
- Day name: `text-xl font-semibold`
- Date: `text-sm text-muted-foreground`
- Section headers: `text-sm font-medium`
- Role abbreviations: `text-xs font-medium text-muted-foreground`
- Names/content: `text-sm`

### Icons
- Small icons: `size-3.5` for compact sections
- Standard icons: `size-4` for buttons

## What NOT to Include
- ❌ No "FINAL All rosters confirmed" status messages
- ❌ No "DRAFT Rosters being finalized" status messages  
- ❌ No "NEXT" badge/button on current week
- ❌ No artist names in song display (space-saving)
- ❌ No edit/admin functionality (this is client/musician view only)

## Dependencies
- React with hooks (useState)
- UI components: Card, Badge, Button, Tabs
- Icons: lucide-react (Calendar, Music, Download, User)

## Example Mock Data

### February 2026 (FINAL)
All 4 Sundays with complete rosters, 3 songs each, all in FINAL status

### March 2026 (DRAFT)
5 Sundays:
- First few with partial rosters (DRAFT)
- Last ones empty/unassigned (DRAFT)

## Mobile Browser Optimization
- Viewport: `min-h-screen`
- Sticky header for navigation context
- No horizontal scroll
- Touch targets appropriately sized
- Clear visual hierarchy
- Reduced vertical space through:
  - Role abbreviations
  - Inline name lists
  - Compact song format
  - Minimal padding/margins
