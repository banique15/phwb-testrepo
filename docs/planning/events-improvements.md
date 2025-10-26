# Events Page Improvements Plan

## Current Analysis

### Overview
The Events page (`src/routes/events/+page.svelte`) implements a master-detail layout showing events in a list on the left and detailed information on the right. While the data display is functional, several critical interactive features are missing or incomplete.

### Current Implementation Status
- ✅ **Working Features:**
  - Master list displays events with basic information
  - Detail view shows comprehensive event data
  - Event selection with localStorage persistence
  - Status badges and date formatting
  - Responsive layout with DaisyUI components

- ❌ **Missing/Broken Features:**
  - Edit button functionality (line 199)
  - Delete button functionality (line 200)
  - Create Event button implementation (line 107)
  - Form validation and error handling
  - Artist assignment UI
  - Related data display (shows IDs instead of names)

## Issues Identified

### Critical Issues (P1)
1. **No Edit Functionality** - Edit button is static with no handler
2. **No Delete Functionality** - Delete button lacks implementation
3. **No Create Functionality** - Create Event button not connected
4. **Missing Form Infrastructure** - No forms, modals, or edit interfaces
5. **No Form Validation** - Missing client/server-side validation
6. **No Error Handling** - No user feedback for failed operations

### High Priority Issues (P2)
7. **Raw ID Display** - Artist assignments show `artist_id: 123` instead of names
8. **Venue/Program IDs** - Shows raw IDs instead of readable names  
9. **JSON Data Display** - Schedule and requirements shown as raw JSON strings
10. **Missing Data Relationships** - No joins to fetch related entity names

### Medium Priority Issues (P3)
11. **No Artist Assignment UI** - Cannot assign artists to events from interface
12. **No Status Management** - Cannot change event status through UI
13. **Limited Schedule Interface** - No structured input for schedule blocks
14. **Requirements Management** - No UI for managing event requirements
15. **No Data Filtering** - Master list lacks search/filter capabilities

### Low Priority Issues (P4)
16. **Missing Rich Text Support** - Plain text for notes/descriptions
17. **No Bulk Operations** - Cannot perform bulk actions on multiple events
18. **Limited Accessibility** - Missing ARIA labels and keyboard navigation
19. **No Data Export** - Cannot export event data
20. **Performance Optimization** - No pagination for large event lists

## Recommended UI Improvements

### 1. Core CRUD Operations

#### Create Event Modal/Form
- **Location**: Modal triggered by "Create Event" button
- **Components**: Full-form with all event fields
- **Validation**: Real-time validation with error messaging
- **UX**: Save as draft or publish functionality

#### Edit Event Interface  
- **Location**: Modal or dedicated page triggered by "Edit" button
- **Features**: Pre-populated form with current event data
- **Capabilities**: 
  - Basic event details editing
  - Artist assignment management
  - Schedule block editing
  - Requirements checklist
  - Status transitions

#### Delete Confirmation
- **Interface**: Confirmation modal with event details
- **Safety**: Clear warning about data loss
- **UX**: Require typing event name for confirmation

### 2. Data Relationship Improvements

#### Artist Assignments
```
Current: artist_id: 123
Improved: John Doe (Lead Vocalist) - Confirmed - $50/hr
```

#### Venue/Program Display
```
Current: venue: 456, program: 789  
Improved: Carnegie Hall, Youth Music Program
```

#### Schedule Presentation
```
Current: {"time": "18:00", "description": "Sound Check"}
Improved: 
6:00 PM - Sound Check
7:00 PM - Artist Arrival
8:00 PM - Performance Start
```

### 3. Interactive Components

#### Artist Assignment Interface
- **Search & Add**: Searchable dropdown to find artists
- **Role Selection**: Dropdown for artist roles (Lead, Support, etc.)
- **Status Management**: Toggle between Pending/Confirmed
- **Rate Setting**: Input for hourly rates

#### Status Transition Controls
- **Visual States**: Clear badges for each status
- **Workflow Buttons**: "Confirm Event", "Mark Complete", "Cancel"
- **Conditional Actions**: Only show relevant transitions

#### Schedule Builder
- **Time Blocks**: Add/remove schedule entries
- **Drag & Drop**: Reorder schedule items
- **Templates**: Common schedule templates

## Implementation Plan

### Phase 1: Core Functionality (Weeks 1-2)
**Priority**: Critical (P1)

#### Tasks:
1. **Create Event Form**
   - [ ] Design modal layout using DaisyUI
   - [ ] Implement form fields with Zod validation
   - [ ] Connect to `eventsStore.create()` 
   - [ ] Add error handling and user feedback
   - [ ] Test form submission flow

2. **Edit Event Form**
   - [ ] Create reusable form component
   - [ ] Pre-populate with selected event data
   - [ ] Connect to `eventsStore.update()`
   - [ ] Handle optimistic updates in UI
   - [ ] Add save/cancel functionality

3. **Delete Event Functionality**
   - [ ] Design confirmation modal
   - [ ] Implement safe deletion with confirmation
   - [ ] Connect to `eventsStore.delete()`
   - [ ] Handle UI updates after deletion
   - [ ] Add undo functionality (optional)

4. **Form Validation & Error Handling**
   - [ ] Implement client-side validation with Zod
   - [ ] Add server-side validation
   - [ ] Design error display components
   - [ ] Add loading states for async operations
   - [ ] Test validation edge cases

### Phase 2: Data Relationships (Weeks 3-4)
**Priority**: High (P2)

#### Tasks:
5. **Artist Name Display**
   - [ ] Modify Supabase queries to join artist names
   - [ ] Update event store to include related data
   - [ ] Replace ID display with names in UI
   - [ ] Add artist profile links (optional)
   - [ ] Test performance impact

6. **Venue/Program Name Resolution**
   - [ ] Create lookup stores for venues/programs
   - [ ] Implement name resolution helpers
   - [ ] Update UI to show names instead of IDs
   - [ ] Add navigation links to related entities
   - [ ] Handle missing/deleted references

7. **Schedule & Requirements UI**
   - [ ] Design structured schedule display
   - [ ] Create requirements checklist component
   - [ ] Parse existing JSON data gracefully
   - [ ] Add fallback for malformed data
   - [ ] Implement responsive layouts

### Phase 3: Advanced Features (Weeks 5-6)
**Priority**: Medium (P3)

#### Tasks:
8. **Artist Assignment Management**
   - [ ] Create artist search/selection component
   - [ ] Design assignment table with actions
   - [ ] Implement add/remove artist functionality
   - [ ] Add role and rate management
   - [ ] Handle assignment status changes

9. **Event Status Management**
   - [ ] Design status transition UI
   - [ ] Implement workflow buttons
   - [ ] Add status change validation
   - [ ] Create status history tracking
   - [ ] Add email notifications (future)

10. **Enhanced Schedule Interface**
    - [ ] Create schedule block editor
    - [ ] Add time validation and conflict detection
    - [ ] Implement drag-and-drop reordering
    - [ ] Create schedule templates
    - [ ] Add bulk schedule operations

### Phase 4: Polish & Performance (Weeks 7-8)
**Priority**: Low (P4)

#### Tasks:
11. **Search & Filtering**
    - [ ] Add search input for events
    - [ ] Implement filter by status/date/venue
    - [ ] Create advanced filter modal
    - [ ] Add saved filter presets
    - [ ] Optimize search performance

12. **Accessibility & UX Polish**
    - [ ] Add ARIA labels and roles
    - [ ] Implement keyboard navigation
    - [ ] Test with screen readers
    - [ ] Add loading skeletons
    - [ ] Optimize mobile experience

## Technical Specifications

### File Structure
```
src/routes/events/
├── +page.svelte              # Main events page (current)
├── components/
│   ├── EventForm.svelte      # Reusable form component
│   ├── EventCard.svelte      # Event list item component
│   ├── ArtistAssignment.svelte # Artist management component
│   ├── ScheduleEditor.svelte  # Schedule block editor
│   └── StatusBadge.svelte    # Status display component
└── modals/
    ├── CreateEvent.svelte    # Create event modal
    ├── EditEvent.svelte      # Edit event modal
    └── DeleteConfirm.svelte  # Delete confirmation modal
```

### Store Enhancements
```typescript
// src/lib/stores/events.ts additions needed:
- Enhanced fetchWithRelations() method
- Real-time subscriptions for changes
- Optimistic update handling
- Bulk operation support
```

### Database Considerations
```sql
-- Potential query optimizations needed:
SELECT 
  e.*,
  v.name as venue_name,
  p.title as program_title,
  COUNT(ea.artist_id) as artist_count
FROM phwb_events e
LEFT JOIN phwb_venues v ON e.venue = v.id
LEFT JOIN phwb_programs p ON e.program = p.id  
LEFT JOIN event_artists ea ON e.id = ea.event_id
GROUP BY e.id, v.name, p.title;
```

## Success Metrics

### Functional Requirements
- [ ] 100% of CRUD operations functional
- [ ] All form validation working correctly
- [ ] Related data displays as names, not IDs
- [ ] Artist assignment fully operational
- [ ] Event status transitions working

### User Experience Goals
- [ ] <2 second load time for event list
- [ ] <500ms form submission feedback
- [ ] Zero data loss during operations
- [ ] Intuitive navigation flow
- [ ] Accessible to screen readers

### Technical Requirements
- [ ] TypeScript strict mode compliance
- [ ] Zod schema validation throughout
- [ ] Supabase RLS properly configured
- [ ] Error boundaries handle all failures
- [ ] Responsive design works on all devices

## Risk Assessment

### High Risk
- **Data Loss**: Implementing delete without proper safeguards
- **Performance**: Large event lists without pagination
- **Validation**: Missing server-side validation

### Medium Risk  
- **UX Confusion**: Complex forms without clear guidance
- **Data Inconsistency**: Race conditions in concurrent updates
- **Mobile Usability**: Complex interfaces on small screens

### Mitigation Strategies
- Implement soft deletes for safety
- Add pagination and virtualization early
- Use SvelteKit form actions for robust validation
- Design mobile-first responsive layouts
- Add optimistic updates with rollback capability

## Conclusion

The Events page has a solid foundation but requires significant development to become fully functional. The prioritized implementation plan focuses on core CRUD operations first, followed by user experience improvements and advanced features. With the proposed 8-week timeline, the Events page will transform from a read-only display into a comprehensive event management interface.

**Next Steps:**
1. Begin Phase 1 implementation with Create Event functionality
2. Set up proper form infrastructure and validation
3. Establish testing procedures for each new feature
4. Create design mockups for complex components (artist assignment, schedule editor)
5. Plan integration with other modules (artists, venues, programs)