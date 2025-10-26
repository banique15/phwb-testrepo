# Issue #1.3: Admin "View As" Functionality

**Title:** `[Feature] Create 'View As' Toggle for Admins`

**Epic:** Foundational User Roles & Permissions

## Description

To facilitate testing and support, Admins need the ability to view the application as if they were another role (11:55). This must be clearly indicated in the UI.

## Acceptance Criteria

- [ ] An admin-only component exists in the UI (e.g., in the header) allowing them to select "View as Director" or "View as Staff"
- [ ] When a view is selected, the entire application UI re-renders as if the admin were logged in with the selected role
- [ ] A persistent, color-coded banner appears at the top of the screen clearly stating "Viewing as Director" or "Viewing as Staff" to avoid confusion (12:16)
- [ ] The admin can easily exit the "View As" mode and return to their full administrator privileges
- [ ] The "View As" state persists across page navigation but not across sessions

## Technical Details

### UI Components
- Create a role switcher dropdown component (admin-only)
- Implement a persistent notification banner component
- Add visual indicators (color coding) for different viewing modes

### State Management
- Create a separate store for "viewing as" state
- Modify permission checks to respect both actual role and "viewing as" role
- Ensure the viewing mode doesn't affect backend permissions

### Color Scheme
- Normal Admin view: No banner
- Viewing as Director: Yellow/Orange banner
- Viewing as Staff: Blue/Green banner

### Example Banner Design
```
[!] Currently viewing as: DIRECTOR [Exit View]
```

## Type
`Feature`

## Labels
`frontend`, `ui`, `admin-tools`

## Priority
Medium - Important for testing and support but not blocking core functionality

## Estimated Effort
1-2 days

## Dependencies
- Issue #1.1 (Backend Role Implementation)
- Issue #1.2 (Frontend Conditional UI)

## Notes
- This feature is for UI preview only - it should NOT grant actual backend permissions
- Consider adding keyboard shortcuts for quick role switching during testing
- Log when admins use this feature for audit purposes
- Banner must be prominent enough to prevent confusion but not obstruct regular UI usage