# issue-1.1-DONE-Rearchitect Payroll Page for Inline Editing and Improved UX

**Epic:** Payroll Page MVP & Workflow Alignment
**Labels:** `frontend`, `ui`, `payroll`, `refactor`, `high-priority`
**Priority:** Critical

## Problem Statement

The current payroll page uses a "Add Entry" drawer workflow that is inefficient and does not align with the user's primary workflow, which is based on a Google Sheet. This friction is a major blocker to user adoption.

## Proposed Solution

To address this, we will re-architect the payroll page to mimic the usability and functionality of the Google Sheet. This involves replacing the current card-based view with a data table that supports inline editing and prioritizes the most recent entries.

### Key Features

1.  **Table-Based Interface:**
    -   Display payroll entries in a data table, sorted by `event_date` in descending order (newest first).
    -   Clicking a `+ Add Entry` button will insert a new, editable row at the top of the table.

2.  **Inline Editing:**
    -   All fields in a table row will be editable inline, eliminating the need for a separate drawer or page.
    -   Changes should be saved automatically on blur or with a single "Save Changes" button.

3.  **Data Columns:**
    -   The table columns will match the Google Sheet structure, including:
        -   `event_date` (Date Picker)
        -   `artist_id` (Dropdown)
        -   `venue_id` (Dropdown with color-coding for venue type)
        -   `hours` (Number Input)
        -   `rate` (Dropdown)
        -   `additional_pay` (Number Input)
        -   `additional_pay_reason` (Dropdown)
        -   `total_pay` (Auto-calculated)
        -   `insperity_hours` (Number Input, defaults to `hours`)
        -   `paid_date` (Date Picker)
        -   `employee_contractor_status` (Indicator)
        -   `invoice_number` (Text Input, optional)
        -   `notes` (Text Input)

### Acceptance Criteria

-   [x] The payroll page displays data in a table, sorted with the newest entries first.
-   [x] An `+ Add Entry` button adds a new, editable row to the top of the table.
-   [x] Users can edit all relevant fields directly within the table cells.
-   [x] Changes to a row are saved successfully.
-   [x] Dropdowns for `artist_id`, `venue_id`, and `rate` are populated with the correct options.
-   [x] `total_pay` is automatically calculated based on `hours` and `rate`.
-   [x] Venue names are color-coded based on their type (e.g., Healing Arts, Creative Placemaking).

## Technical Notes

-   This is a significant architectural change from the current implementation.
-   Focus on performance, especially with large datasets.
-   Consider implementing keyboard navigation for efficient data entry.
-   The `payrollSchema` in `src/lib/schemas/payroll.ts` provides the data model for this feature.
