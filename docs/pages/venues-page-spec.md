# Venues Page Specification

**Status**: Complete  
**Priority**: Medium  
**Owner**: Development Team  
**Created**: 2025-01-24  
**Last Updated**: 2025-01-24  
**Version**: 1.0.0  
**Route**: `/venues` (src/routes/venues/+page.svelte)

---

## 📋 Page Metadata

| Field | Value |
|-------|-------|
| **Page Type** | Master-Detail List/CRUD with Enhanced Styling |
| **Authentication** | Required |
| **Layout** | Standard (with Sidebar) |
| **Dependencies** | Venues store, Venue schema |
| **Mobile Responsive** | Yes (responsive grid layout) |
| **Real-time Updates** | Yes (via store subscriptions) |

---

## 🎯 Page Purpose

The Venues page manages venue information and locations for events. It provides:
- **Comprehensive venue management** with location and facility details
- **Venue type categorization** with color-coded badges
- **Contact and parking information** management
- **Enhanced visual design** with color-coded sections and borders
- **Image management** for venue visualization

---

## 📊 Current Implementation

### Data Sources
- **Venues Store**: `$lib/stores/venues` - CRUD operations with store subscription
- **Store State**: Manual subscription pattern with derived state
- **Local Storage**: Selected venue persistence

### Components Used
- `PageHeader` - Title, subtitle, and action buttons
- `ErrorBoundary` - Error handling wrapper
- Enhanced DaisyUI styling with color-coded sections

### Layout Structure
```
Venues Page
├── Fixed Header Section
│   ├── PageHeader Component
│   │   ├── Title: "Venues"
│   │   ├── Subtitle: "Manage venue information and locations"
│   │   └── Actions
│   │       └── Add Venue Button (placeholder)
├── Scrollable Content Area
│   └── Enhanced Grid Layout (1 col mobile, 3 col desktop)
│       ├── Master List (1/3 width, primary border)
│       │   ├── Header with count and primary theme
│       │   ├── Venue cards with type badges
│       │   └── Reference information display
│       └── Detail Panel (2/3 width, accent border)
│           ├── Venue Header (name, type, reference, actions)
│           ├── Basic Information (primary theme)
│           ├── Contact Information (accent theme)
│           ├── Description (secondary theme)
│           ├── Venue Image (info theme)
│           ├── Parking Information (warning theme)
│           └── Feature Summary Stats (success theme)
└── Empty States and Loading Indicators
```

---

## 🎨 UI Components

### Type-Based Color System
| Venue Type | Badge Class | Visual Indication |
|------------|-------------|-------------------|
| **Healing Arts** | `badge-success` | Green |
| **Performance** | `badge-secondary` | Purple |
| **Community** | `badge-accent` | Pink |
| **Education** | `badge-info` | Blue |
| **Default** | `badge-neutral` | Gray |

### Enhanced Section Styling
| Section | Border Color | Text Color | Purpose |
|---------|--------------|------------|---------|
| **Basic Information** | `border-primary` | `text-primary` | Core venue data |
| **Contact Information** | `border-accent` | `text-accent` | Contact details |
| **Description** | `border-secondary` | `text-secondary` | Venue description |
| **Venue Image** | `border-info` | `text-info` | Visual content |
| **Parking Information** | `border-warning` | `text-warning` | Parking details |
| **Venue Features** | `border-success` | `text-success` | Feature summary |

### Master List Items
| Display Field | Data Source | Styling |
|---------------|-------------|---------|
| **Venue Name** | `venue.name` | `font-semibold text-base-content` |
| **Address** | `venue.address` | `text-sm opacity-70` |
| **Type Badge** | `venue.type` with color coding | Dynamic badge colors |
| **Reference** | `venue.reference` | `text-xs opacity-50 bg-base-200` |

---

## 🔄 Data Loading Strategy

### Client-Side Loading with Store Subscription
- **Initial Load**: `venuesStore.fetchAll()` in `onMount`
- **Store Subscription**: Manual subscription to store changes
- **Selection Management**: `$effect` for localStorage restoration
- **Reactive State**: Derived state from store subscription

### Data Flow
1. **Page Mount** → Fetch all venues from store
2. **Store Subscription** → Manual subscription to state changes
3. **Effect Hook** → Restore selection from localStorage
4. **Selection Updates** → Persist to localStorage on venue selection

### State Management Pattern
```typescript
// Manual store subscription
let storeState = $state<any>()
let venues = $derived(storeState?.items || [])

venuesStore.subscribe(state => {
	storeState = state
})
```

---

## 📱 Responsive Design

### Desktop Layout (lg: 1024px+)
- **Enhanced Grid**: 1/3 master (primary theme), 2/3 detail (accent theme)
- **Color-Coded Sections**: Six different themed sections
- **Detail Grid**: 2-column layout for sections
- **Visual Hierarchy**: Color-coded borders and text

### Mobile Layout (default)
- **Single Column**: Stacked layout with preserved theming
- **Responsive Cards**: Maintained color system
- **Touch Optimization**: Large touch targets

---

## 🚨 Current Issues & Limitations

### Performance Issues
- [ ] **Client-side Only**: No server-side rendering
- [ ] **Manual Store Subscription**: Complex state management pattern
- [ ] **No Pagination**: All venues loaded at once

### UX Issues
- [ ] **Placeholder Actions**: Edit/Delete buttons non-functional
- [ ] **Raw Data Display**: Contact/parking info shows key-value pairs
- [ ] **Basic Image Handling**: No image loading error states
- [ ] **Limited Search**: No search or filtering capabilities

### Technical Debt
- [ ] **Complex State Pattern**: Mixed store subscription and effects
- [ ] **Redundant Color System**: Could be more systematic
- [ ] **JSON Data Display**: Raw object formatting for structured data

---

## 🎯 Enhancement Opportunities

### P0 - Critical Improvements
- [ ] **CRUD Functionality**: Implement functional Add/Edit/Delete operations - Owner: Dev Team - Due: 2025-02-01
- [ ] **Server-Side Rendering**: Add `+page.server.ts` for initial data - Owner: Dev Team - Due: 2025-02-01

### P1 - High Impact
- [ ] **Search and Filtering**: Add venue search by name, type, location - Owner: Dev Team - Due: 2025-02-07
- [ ] **Contact Management**: Structured contact information UI - Owner: Dev Team - Due: 2025-02-14
- [ ] **Parking Information**: Better parking details display - Owner: Dev Team - Due: 2025-02-14

### P2 - Medium Impact
- [ ] **Image Gallery**: Multiple image support with gallery - Owner: Dev Team - Due: 2025-02-21
- [ ] **Map Integration**: Location mapping and directions - Owner: Dev Team - Due: 2025-02-28
- [ ] **Accessibility Features**: Venue accessibility information - Owner: Dev Team - Due: 2025-03-07

---

## 🛠️ Technical Specifications

### File Structure
```
src/routes/venues/
├── +page.svelte                           # Main venues component
└── (future)
    ├── +page.server.ts                    # SSR data loading
    ├── components/
    │   ├── VenueForm.svelte               # Create/edit form
    │   ├── ContactEditor.svelte           # Contact information editor
    │   ├── ParkingEditor.svelte           # Parking information editor
    │   └── ImageGallery.svelte            # Image management
    └── modals/
        ├── CreateVenue.svelte             # New venue modal
        ├── EditVenue.svelte               # Edit venue modal
        └── DeleteConfirm.svelte           # Deletion confirmation
```

### Dependencies
```typescript
// Core Svelte
import { onMount } from 'svelte'
import { browser } from '$app/environment'

// Data and Types
import { venuesStore } from '$lib/stores/venues'
import type { Venue } from '$lib/schemas/venue'

// Components
import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
import PageHeader from '$lib/components/ui/PageHeader.svelte'
```

### Enhanced Styling System
```typescript
// Type-based badge colors
function getTypeColor(type: string | undefined) {
	switch (type?.toLowerCase()) {
		case 'healing arts': return 'badge-success'
		case 'performance': return 'badge-secondary'
		case 'community': return 'badge-accent'
		case 'education': return 'badge-info'
		default: return 'badge-neutral'
	}
}
```

---

## 📝 Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-01-24 | 1.0.0 | Development Team | Initial venues page specification created |

---

*This specification serves as the source of truth for the Venues page. Update this document before requesting changes to ensure accurate implementation.*