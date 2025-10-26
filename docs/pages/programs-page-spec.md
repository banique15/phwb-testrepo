# Programs Page Specification

**Status**: Complete  
**Priority**: Medium  
**Owner**: Development Team  
**Created**: 2025-01-24  
**Last Updated**: 2025-01-24  
**Version**: 1.0.0  
**Route**: `/programs` (src/routes/programs/+page.svelte)

---

## 📋 Page Metadata

| Field | Value |
|-------|-------|
| **Page Type** | Master-Detail List/CRUD with Timeline Features |
| **Authentication** | Required |
| **Layout** | Standard (with Sidebar) |
| **Dependencies** | Programs store, Program schema |
| **Mobile Responsive** | Yes (responsive grid layout) |
| **Real-time Updates** | Yes (via store subscriptions) |

---

## 🎯 Page Purpose

The Programs page manages program offerings and structure for the organization. It provides:
- **Program lifecycle management** with start/end dates and status tracking
- **Timeline visualization** with progress indicators and status calculation
- **Geographic coverage tracking** for program reach
- **Partner relationship linking** for collaborative programs
- **Smart status calculation** based on current date and program timeline

---

## 📊 Current Implementation

### Data Sources
- **Programs Store**: `$lib/stores/programs` - CRUD operations and state management
- **Programs State**: Direct access to reactive store state
- **Local Storage**: Selected program persistence

### Components Used
- `PageHeader` - Title, subtitle, and action buttons
- `ErrorBoundary` - Error handling wrapper
- Custom timeline visualization and status calculation
- DaisyUI components for layout and styling

### Layout Structure
```
Programs Page
├── Fixed Header Section
│   ├── PageHeader Component
│   │   ├── Title: "Programs"
│   │   ├── Subtitle: "Manage program offerings and structure"
│   │   └── Actions
│   │       └── Add Program Button (placeholder)
├── Scrollable Content Area
│   └── Responsive Grid Layout (1 col mobile, 3 col desktop)
│       ├── Master List (1/3 width desktop)
│       │   ├── Header with count
│       │   ├── Program cards with status badges
│       │   └── Geographic coverage display
│       └── Detail Panel (2/3 width desktop)
│           ├── Program Header (title, status, coverage, actions)
│           ├── Program Details Section
│           ├── Timeline Section
│           ├── Description Section
│           └── Timeline Visualization (progress bar)
└── Empty States (no programs, no selection)
```

---

## 🎨 UI Components

### Smart Status System
| Status | Condition | Badge Class | Logic |
|--------|-----------|-------------|-------|
| **Upcoming** | Start date > now | `badge-info` | Future programs |
| **Active** | Start ≤ now ≤ end | `badge-success` | Currently running |
| **Completed** | End date < now | `badge-neutral` | Finished programs |
| **Unknown** | Missing dates | `badge-outline` | Incomplete data |

### Timeline Visualization
- **Progress Bar**: Visual representation of program progress
- **Dynamic Width**: Calculated percentage based on current date
- **Color Coding**: Primary theme color for active progress
- **Date Labels**: Start and end dates displayed below bar

### Master List Items
| Display Field | Data Source | Styling |
|---------------|-------------|---------|
| **Program Title** | `program.title` | `font-medium` |
| **Geographic Coverage** | `program.geo_coverage` | `text-sm opacity-70` |
| **Status Badge** | Calculated from dates | Dynamic colors |
| **Start Date** | `formatDate(program.start_date)` | `text-xs opacity-50` |

### Detail Panel Sections
| Section | Purpose | Features |
|---------|---------|----------|
| **Program Details** | Basic information | Title, coverage, partner ID, created date |
| **Timeline** | Date management | Start/end dates, duration calculation, status |
| **Description** | Program details | Full description with whitespace preservation |
| **Timeline Visualization** | Progress tracking | Interactive progress bar with calculated percentage |

---

## 🔄 Data Loading Strategy

### Client-Side Loading
- **Initial Load**: `programsStore.fetchAll()` in `onMount`
- **Direct Store Access**: `$programsState.items` for reactive data
- **Selection Restoration**: localStorage restoration in `onMount`
- **State Management**: Simple reactive pattern with direct store access

### Data Flow
1. **Page Mount** → Fetch all programs and restore selection
2. **Direct Store Access** → Reactive updates through `$programsState`
3. **Selection Management** → Persist selection to localStorage
4. **Timeline Calculation** → Real-time status and progress calculation

### Smart Calculations
```typescript
// Duration calculation
function calculateDuration(startDate, endDate) {
	// Returns human-readable duration (days, months, years)
}

// Status determination
function getStatusText(startDate, endDate) {
	// Returns "Upcoming", "Active", "Completed", or "Unknown"
}

// Progress calculation for timeline visualization
const progress = Math.min(100, Math.max(0, ((now - start) / total) * 100))
```

---

## 📱 Responsive Design

### Desktop Layout (lg: 1024px+)
- **Grid**: 1/3 master list, 2/3 detail panel
- **Timeline Visualization**: Full-width progress bar
- **Detail Grid**: 2-column layout for sections

### Mobile Layout (default)
- **Single Column**: Stacked layout
- **Responsive Timeline**: Maintains progress bar on mobile
- **Touch Optimization**: Large touch targets for program cards

---

## 🚨 Current Issues & Limitations

### Performance Issues
- [ ] **Client-side Only**: No server-side rendering
- [ ] **No Pagination**: All programs loaded at once
- [ ] **Direct Store Access**: Could benefit from derived state pattern

### UX Issues
- [ ] **Placeholder Actions**: Edit/Delete buttons non-functional
- [ ] **Basic Partner Display**: Shows partner ID instead of name
- [ ] **Limited Timeline Features**: No milestone or phase management
- [ ] **No Search/Filter**: Missing search functionality

### Technical Debt
- [ ] **Simple Data Model**: Limited program structure
- [ ] **Basic Visualization**: Simple progress bar only
- [ ] **No Validation**: No date validation or business rules

---

## 🎯 Enhancement Opportunities

### P0 - Critical Improvements
- [ ] **CRUD Functionality**: Implement functional Add/Edit/Delete operations - Owner: Dev Team - Due: 2025-02-01
- [ ] **Server-Side Rendering**: Add `+page.server.ts` for initial data - Owner: Dev Team - Due: 2025-02-01

### P1 - High Impact
- [ ] **Partner Integration**: Show partner names instead of IDs - Owner: Dev Team - Due: 2025-02-07
- [ ] **Advanced Timeline**: Milestones, phases, and deadlines - Owner: Dev Team - Due: 2025-02-14
- [ ] **Search and Filtering**: Filter by status, dates, partner - Owner: Dev Team - Due: 2025-02-14

### P2 - Medium Impact
- [ ] **Calendar Integration**: Calendar view for program timeline - Owner: Dev Team - Due: 2025-02-21
- [ ] **Program Templates**: Template-based program creation - Owner: Dev Team - Due: 2025-02-28
- [ ] **Reporting**: Program performance and metrics - Owner: Dev Team - Due: 2025-03-07

### P3 - Nice to Have
- [ ] **Resource Management**: Budget and resource tracking - Owner: Dev Team - Due: TBD
- [ ] **Goal Tracking**: Program objectives and KPIs - Owner: Dev Team - Due: TBD
- [ ] **Collaboration**: Team assignment and communication - Owner: Dev Team - Due: TBD

---

## 🛠️ Technical Specifications

### File Structure
```
src/routes/programs/
├── +page.svelte                           # Main programs component
└── (future)
    ├── +page.server.ts                    # SSR data loading
    ├── components/
    │   ├── ProgramForm.svelte             # Create/edit form
    │   ├── TimelineEditor.svelte          # Timeline management
    │   ├── MilestoneManager.svelte        # Milestone tracking
    │   └── ProgressChart.svelte           # Advanced progress visualization
    └── modals/
        ├── CreateProgram.svelte           # New program modal
        ├── EditProgram.svelte             # Edit program modal
        └── DeleteConfirm.svelte           # Deletion confirmation
```

### Dependencies
```typescript
// Core Svelte
import { onMount } from 'svelte'
import { browser } from '$app/environment'

// Data and Types
import { programsStore, programsState } from '$lib/stores/programs'
import type { Program } from '$lib/schemas/program'

// Components
import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
import PageHeader from '$lib/components/ui/PageHeader.svelte'
```

### Timeline Calculation Functions
```typescript
// Duration calculation with human-readable output
function calculateDuration(startDate: string | undefined, endDate: string | undefined) {
	// Returns formatted duration string
}

// Status calculation based on current date
function getStatusColor(startDate: string | undefined, endDate: string | undefined) {
	// Returns appropriate badge class
}

// Progress percentage for timeline visualization
function calculateProgress(startDate: string, endDate: string) {
	// Returns 0-100 percentage for progress bar
}
```

---

## 📝 Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-01-24 | 1.0.0 | Development Team | Initial programs page specification created |

---

*This specification serves as the source of truth for the Programs page. Update this document before requesting changes to ensure accurate implementation.*