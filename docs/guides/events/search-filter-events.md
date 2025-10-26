# Search and Filter Events Workflow

## Overview
Guide for finding and filtering events using the search and filter system.

## Prerequisites
- Access to Events page
- Events exist in system

## Search Capabilities
1. **Text Search**: Search by event title or notes
2. **Status Filter**: Filter by event status (planned, confirmed, completed, etc.)
3. **Venue Filter**: Filter by specific venues
4. **Program Filter**: Filter by associated programs
5. **Date Filters**: Filter by date ranges (upcoming, past, this week, this month, custom)

## Steps
1. Navigate to Events page
2. Use search bar for text search
3. Click "Filters" to expand filter options
4. Select desired filters
5. Apply date range filters if needed
6. View filtered results
7. Clear filters as needed

## Filter Options
- **All Statuses**: No status filtering
- **Planned**: Events in planning phase
- **Confirmed**: Confirmed events
- **In Progress**: Currently happening events
- **Completed**: Finished events
- **Cancelled**: Cancelled events

## Date Filter Options
- **All Dates**: No date filtering
- **Upcoming**: Future events only
- **Past**: Historical events only
- **This Week**: Events in current week
- **This Month**: Events in current month
- **Custom Range**: Specify exact date range

## Success Criteria
- Relevant events displayed
- Filter state maintained in URL
- Results update in real-time

## Tips
- Search is debounced (300ms delay) for performance
- Filters can be combined for precise results
- URL parameters preserve filter state for bookmarking
- Statistics show counts for different event types

## Related Documentation
- [Create Event](./create-event.md)
- [Edit Event](./edit-event.md)