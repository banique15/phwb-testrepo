# Events Page Specification

**Status**: Complete  
**Priority**: High  
**Owner**: Development Team  
**Created**: 2025-01-24  
**Last Updated**: 2025-01-24  
**Version**: 1.1.0  
**Route**: `/events` (src/routes/events/+page.svelte)

---

## 📋 Page Metadata

| Field | Value |
|-------|-------|
| **Page Type** | Master-Detail List/CRUD with Modal System |
| **Authentication** | Required |
| **Layout** | Standard (with Sidebar) |
| **Dependencies** | Events stores (basic + enhanced), Modal components, Schedule/Requirements components |
| **Mobile Responsive** | Yes (responsive grid layout) |
| **Real-time Updates** | Yes (via store subscriptions) |

---

## 🎯 Page Purpose

The Events page serves as the central hub for event scheduling and coordination. It provides:
- **Comprehensive event listing** with status indicators and temporal context
- **Detailed event information** including artist assignments, schedules, and requirements
- **Full CRUD operations** through modal interfaces (Create, Edit, Delete)
- **Master-detail layout** with responsive behavior
- **Enhanced event data** with joined information from related tables
- **Complex data visualization** for schedules, assignments, and feedback

---

## 📊 Current Implementation

### Data Sources
- **Events Enhanced Store**: `$lib/stores/events-enhanced` - Main data source with joined information
- **Events Store**: `$lib/stores/events` - Basic CRUD operations (fallback)
- **Modal Components**: Local modal state management
- **Local Storage**: Selected event persistence

### Components Used
- `PageHeader` - Title, subtitle, and primary actions
- `ErrorBoundary` - Error handling wrapper
- **Modal System**:
  - `CreateEvent` - New event creation
  - `EditEvent` - Event modification
  - `DeleteConfirm` - Deletion confirmation
- **Specialized Components**:
  - `ScheduleDisplay` - Event schedule visualization
  - `RequirementsDisplay` - Requirements breakdown
- DaisyUI components for layout and styling

### Layout Structure
```
Events Page
├── Fixed Header Section
│   ├── PageHeader Component
│   │   ├── Title: "Events"
│   │   ├── Subtitle: "Manage event scheduling and coordination"
│   │   └── Actions
│   │       └── Create Event Button
├── Scrollable Content Area
│   └── Responsive Grid Layout (1 col mobile, 3 col desktop)
│       ├── Master List (1/3 width desktop)
│       │   ├── Header with count
│       │   ├── Scrollable event list
│       │   └── Event cards with status/timing
│       └── Detail Panel (2/3 width desktop)
│           ├── Event Header (title, status, actions)
│           ├── Event Details Section
│           ├── Location & References Section
│           ├── Artist Assignments Table
│           ├── Schedule Display
│           ├── Requirements Display
│           ├── Internal Notes/Feedback
│           └── Event Summary Stats
└── Modal Overlays (Create/Edit/Delete)
```

---

## 🎨 UI Components

### Master List Items
| Display Field | Data Source | Styling |
|---------------|-------------|---------|
| **Title** | `event.title` | `font-medium` |
| **Date** | `formatDate(event.date)` | `text-sm opacity-70` |
| **Status Badge** | `event.status` with dynamic colors | Color-coded badges |
| **Temporal Indicator** | Date comparison logic | "Upcoming"/"Past" labels |
| **Time Range** | `start_time - end_time` | `text-xs opacity-50` |

### Status Badge Colors
| Status | CSS Class | Visual Indication |
|--------|-----------|-------------------|
| **Scheduled** | `badge-info` | Blue |
| **Completed** | `badge-success` | Green |
| **Cancelled** | `badge-error` | Red |
| **Confirmed** | `badge-primary` | Primary theme color |
| **Default** | `badge-outline` | Outline only |

### Detail Panel Sections
| Section | Purpose | Data Sources |
|---------|---------|--------------|
| **Event Details** | Basic event information | Title, date, times, status |
| **Location & References** | Venue and program linkage | Venue name/ID, Program name/ID |
| **Artist Assignments** | Personnel and compensation | `artist_assignments` array with rates/roles |
| **Schedule** | Event timeline | `schedule` object via ScheduleDisplay |
| **Requirements** | Event needs | `requirements` object via RequirementsDisplay |
| **Internal Notes** | Feedback and notes | `feedback.internal_notes` array |
| **Summary Stats** | Quick overview | Aggregated data cards |

---

## 🔄 Data Loading Strategy

### Server-Side Rendering (SSR) ✅
- **Initial Load**: Complete data fetched in `+page.server.ts`
- **URL State Management**: All filters and pagination in URL parameters
- **Performance Optimization**: Individual operation timing and headers
- **Enhanced Store**: Uses joined queries for richer data
- **Local Storage**: Persists selected event across sessions
- **Real-time Updates**: Store subscription for live data

### Data Flow
1. **Page Mount** → Store fetch all events with enhanced data
2. **Store Subscription** → Reactive updates to component state
3. **Selection Persistence** → localStorage for selected event
4. **Modal Operations** → Refresh data after successful operations

### Enhanced Data Structure
```typescript
interface EnhancedEvent extends Event {
  venue_name?: string        // Joined from venues table
  program_name?: string      // Joined from programs table
  artist_assignments?: {     // Joined artist assignment data
    artist_id: number
    artist_name: string
    role: string
    status: string
    num_hours: number
    hourly_rate: number
  }[]
}
```

---

## 📱 Responsive Design

### Desktop Layout (lg: 1024px+)
- **Grid**: 1/3 master list, 2/3 detail panel
- **Height**: Fixed height with scrollable areas
- **Detail Grid**: 2-column layout for sections

### Tablet Layout (md: 768px+)  
- **Grid**: Maintained 3-column structure
- **Detail Grid**: 2-column layout preserved
- **Touch Optimization**: Larger touch targets

### Mobile Layout (default)
- **Grid**: Single column, stacked layout
- **Detail Grid**: Single column for all sections
- **Full Height**: Optimized for mobile screens

### Mobile Considerations
- **Touch-friendly**: Large buttons and cards
- **Scrollable Areas**: Properly constrained scrolling
- **Responsive Tables**: Horizontal scroll for artist assignments
- **Status Indicators**: Clearly visible badges and labels

---

## 🚨 Current Issues & Limitations

### Performance Issues
- [x] **Client-side Only**: Server-side rendering now implemented ✅
- [ ] **Large Data Sets**: No pagination or virtualization
- [ ] **Multiple Store Pattern**: Both basic and enhanced stores exist

### UX Issues
- [ ] **Modal Only CRUD**: No inline editing capabilities
- [x] **Limited Search**: Search and filtering functionality now implemented ✅
- [ ] **No Bulk Operations**: Cannot perform batch operations
- [ ] **Legacy Data Handling**: Dual support for old/new data formats

### Technical Debt
- [ ] **Store Redundancy**: Two separate event stores (basic/enhanced)
- [ ] **Data Format Inconsistency**: Legacy artist assignment format support
- [ ] **Complex State Management**: Mixed store subscriptions and local state
- [ ] **Modal System**: Could be more reusable/standardized

---

## 🎯 Enhancement Opportunities

### P0 - Critical Improvements ✅ COMPLETED
- [x] **Server-Side Rendering**: Implement `+page.server.ts` for initial data - Owner: Dev Team - Completed: 2025-01-24
- [x] **Search and Filtering**: Add event search capabilities - Owner: Dev Team - Completed: 2025-01-24
- [ ] **Store Consolidation**: Unify basic and enhanced stores - Owner: Dev Team - Due: 2025-02-07

### P1 - High Impact
- [ ] **Pagination**: Add pagination for large event lists - Owner: Dev Team - Due: 2025-02-07
- [ ] **Calendar View**: Monthly/weekly calendar layout option - Owner: Dev Team - Due: 2025-02-14
- [ ] **Inline Editing**: Quick edit capabilities without modals - Owner: Dev Team - Due: 2025-02-14
- [ ] **Bulk Operations**: Multi-select and batch actions - Owner: Dev Team - Due: 2025-02-21

### P2 - Medium Impact
- [ ] **Advanced Filtering**: Filter by status, date range, venue, program - Owner: Dev Team - Due: 2025-02-21
- [ ] **Event Templates**: Create events from templates - Owner: Dev Team - Due: 2025-02-28
- [ ] **Notification System**: Alerts for upcoming events - Owner: Dev Team - Due: 2025-02-28
- [ ] **Export Functionality**: Export event data and schedules - Owner: Dev Team - Due: 2025-03-07

### P3 - Nice to Have
- [ ] **Mobile App Features**: Native mobile optimizations - Owner: Dev Team - Due: TBD
- [ ] **Integration**: Calendar app synchronization - Owner: Dev Team - Due: TBD
- [ ] **Analytics**: Event performance metrics - Owner: Dev Team - Due: TBD
- [ ] **AI Assistance**: Smart scheduling suggestions - Owner: Dev Team - Due: TBD

---

## 🛠️ Technical Specifications

### File Structure
```
src/routes/events/
├── +page.svelte                           # Main events component
├── +page.server.ts                        # ✅ SSR data loading (implemented)
├── +page.ts                               # Client-side data pass-through
├── components/
│   ├── ScheduleDisplay.svelte             # Schedule visualization
│   ├── RequirementsDisplay.svelte         # Requirements breakdown
│   ├── ArtistAssignment.svelte            # Artist assignment management
│   ├── ScheduleEditor.svelte              # Schedule editing
│   ├── RequirementsEditor.svelte          # Requirements editing
│   ├── StatusManager.svelte               # Status workflow management
│   ├── EventForm.svelte                   # Reusable event form component
│   └── EventsSearchFilters.svelte         # ✅ Search and filtering (implemented)
├── modals/
│   ├── CreateEvent.svelte                 # New event creation
│   ├── EditEvent.svelte                   # Event modification
│   └── DeleteConfirm.svelte               # Deletion confirmation
└── (future)
    └── components/
        ├── EventCalendar.svelte           # Calendar view
        └── EventTemplates.svelte          # Template management
```

### Dependencies
```typescript
// Core Svelte
import { onMount } from 'svelte'
import { browser } from '$app/environment'

// Data and Types
import { eventsStore } from '$lib/stores/events'
import { eventsEnhancedStore, type EnhancedEvent } from '$lib/stores/events-enhanced'
import type { Event } from '$lib/schemas/event'

// Components
import CreateEvent from './modals/CreateEvent.svelte'
import EditEvent from './modals/EditEvent.svelte'
import DeleteConfirm from './modals/DeleteConfirm.svelte'
import ScheduleDisplay from './components/ScheduleDisplay.svelte'
import RequirementsDisplay from './components/RequirementsDisplay.svelte'
import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
import PageHeader from '$lib/components/ui/PageHeader.svelte'
```

### State Management
```typescript
// Loading and error states
let loading = $state(true)
let error = $state('')
let selectedEvent = $state<EnhancedEvent | null>(null)

// Modal states
let showCreateModal = $state(false)
let showEditModal = $state(false)
let showDeleteModal = $state(false)

// Store subscription and reactive state
let storeState = $state<any>()
let events = $derived(storeState?.items || [])

// Local storage key for persistence
const STORAGE_KEY = 'phwb-selected-event'
```

### Modal System Pattern
```typescript
// Modal handlers follow consistent pattern
function openCreateModal() { showCreateModal = true }
function closeCreateModal() { showCreateModal = false }
function openEditModal() { if (selectedEvent) showEditModal = true }
function closeEditModal() { showEditModal = false }

// Success handler refreshes data and manages selection
function handleModalSuccess() {
	eventsEnhancedStore.fetchAll()
	if (showDeleteModal && selectedEvent) {
		selectedEvent = null
		if (browser) localStorage.removeItem(STORAGE_KEY)
	}
}
```

---

## 🔄 Proposed Changes Template

### Change Request Format
When requesting changes to this page, use this format:

#### Change Type
- [ ] **Content Update** - Modify existing content/data
- [ ] **Layout Change** - Alter visual arrangement
- [ ] **Feature Addition** - Add new functionality
- [ ] **Performance** - Optimize loading/rendering
- [ ] **Bug Fix** - Resolve existing issues

#### Specific Changes
1. **Component/Section**: [Which part to modify]
2. **Current Behavior**: [What it does now]
3. **Desired Behavior**: [What it should do]
4. **Acceptance Criteria**: [How to verify the change]

#### Example Change Request
```
Change Type: Feature Addition
Component: Master List
Current Behavior: Shows all events without search/filter capabilities
Desired Behavior: Add search input and status filter dropdown above event list
Acceptance Criteria: 
- Search input filters events by title and description
- Status dropdown filters by event status
- Filters work independently and can be combined
- URL parameters persist filter state
```

---

## 📈 Success Metrics

### Performance Targets
- **Page Load Time**: < 800ms for initial events fetch
- **Modal Open Time**: < 200ms
- **Search Response**: < 300ms with debouncing
- **Real-time Update Latency**: < 3s

### User Experience Targets
- **Event Detail Engagement**: > 70% view event details
- **CRUD Operation Success Rate**: > 95%
- **Modal Completion Rate**: > 80% for create/edit operations
- **Mobile Usage**: > 40% of interactions on mobile devices

### Technical Targets
- **Error Rate**: < 1% of operations
- **Data Consistency**: 100% real-time update reliability
- **Modal System Performance**: < 100ms open/close transitions
- **Memory Usage**: Stable over long sessions

---

## 📚 Related Documentation

### Code References
- [`src/routes/events/+page.svelte:1`](../../src/routes/events/+page.svelte) - Main events component
- [`src/lib/stores/events-enhanced.ts:1`](../../src/lib/stores/events-enhanced.ts) - Enhanced events store with joins
- [`src/lib/stores/events.ts:1`](../../src/lib/stores/events.ts) - Basic events store
- [`src/routes/events/modals/CreateEvent.svelte:1`](../../src/routes/events/modals/CreateEvent.svelte) - Create event modal
- [`src/routes/events/components/ScheduleDisplay.svelte:1`](../../src/routes/events/components/ScheduleDisplay.svelte) - Schedule visualization

### Store Documentation
- [`src/lib/stores/events-enhanced.ts`](../../src/lib/stores/events-enhanced.ts) - Enhanced events with venue/program names
- [`src/lib/stores/events.ts`](../../src/lib/stores/events.ts) - Basic CRUD operations for events

### Component Documentation
- [`src/routes/events/components/`](../../src/routes/events/components/) - Specialized event components
- [`src/routes/events/modals/`](../../src/routes/events/modals/) - Modal system for CRUD operations

### Design System
- [DaisyUI Badge Component](https://daisyui.com/components/badge/) - Status indicators
- [DaisyUI Table Component](https://daisyui.com/components/table/) - Artist assignments display
- [DaisyUI Modal Component](https://daisyui.com/components/modal/) - CRUD modal interfaces

---

## 📝 Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-01-24 | 1.0.0 | Development Team | Initial events page specification created |
| 2025-01-24 | 1.1.0 | Development Team | Updated to reflect implemented features: SSR, search/filtering capabilities |

---

## 💬 Modification Instructions

### How to Request Changes
1. **Identify the section** you want to modify in this document
2. **Update the specification** with your desired changes
3. **Add to change log** with new version number
4. **Mention Claude Code** with changes and this document
5. **Claude will implement** the changes based on the updated spec

### Change Categories
- **UI/Layout**: Modify visual appearance or arrangement
- **Data/Content**: Change what information is displayed
- **Functionality**: Add or modify interactive features
- **Performance**: Optimize loading or rendering
- **Accessibility**: Improve screen reader or keyboard navigation

### Example Workflow
1. Edit this document to specify desired changes
2. Update version number and change log
3. Tell Claude Code: "Please implement the changes in events-page-spec.md version 1.1.0"
4. Claude Code will read this spec and implement the changes

---

*This specification serves as the source of truth for the Events page. Update this document before requesting changes to ensure accurate implementation.*