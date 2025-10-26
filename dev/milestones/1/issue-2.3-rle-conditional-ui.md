# Issue #1.2: Frontend Conditional UI

**Title:** `[Feature] Implement Conditional UI Rendering Based on User Role`

**Epic:** Foundational User Roles & Permissions

## Description

The user interface must change dynamically based on the logged-in user's role to limit access and simplify the view (11:06).

### UI Variations by Role:
- **Administrator:** Sees all UI elements and has access to all functionality
- **Director:** Sees most UI elements, with potential restrictions on application-level settings
- **Staff:** Sees a significantly simplified UI, primarily focused on their own tasks and entries

## Acceptance Criteria

- [ ] Navigation menus and page components are conditionally rendered based on the user's role
- [ ] Actions (e.g., "Add User" button) are hidden or disabled if the user lacks permission
- [ ] The application correctly fetches the user's role on login and uses it to drive the UI state
- [ ] Role-based routing protection prevents unauthorized access to restricted pages
- [ ] UI elements gracefully handle permission-based visibility without layout shifts

## Technical Details

### Implementation Approach
- Create a role-based permission store using Svelte 5 runes
- Implement role checking utilities/components
- Conditionally render navigation items in the sidebar
- Add role guards to routes that require specific permissions

### Components to Update
- `src/lib/components/Sidebar.svelte` - Conditional menu items
- `src/routes/+layout.svelte` - Role-based layout adjustments
- Individual route pages - Permission-based feature visibility

### Example Code Pattern
```svelte
{#if $userRole === 'admin' || $userRole === 'director'}
  <Button onclick={addUser}>Add User</Button>
{/if}
```

## Type
`Feature`

## Labels
`frontend`, `ui`, `permissions`

## Priority
High - Critical for proper access control and user experience

## Estimated Effort
2-3 days

## Dependencies
- Issue #1.1 (Backend Role Implementation) must be completed first
- User authentication system must be functional

## Notes
- Ensure consistent UI patterns across all role-based conditional rendering
- Consider creating reusable permission checking components
- Staff should have a notably cleaner, simpler interface focused on their daily tasks