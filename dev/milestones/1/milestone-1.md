### **Milestone: Achieve MVP for Google Sheet Migration**

* **Goal:** Adapt the `phwb.singforhope.org` application to fully replace the existing Google Doc timesheet system for the `FY25` period. The primary focus is achieving feature parity and workflow continuity through an admin-only MVP, followed by multi-role support and backwards compatibility with the RLE-based conditional UI system.
* **Target Completion:** `[End of Sprint - Date]`
* **Key Outcome:** Staff and Directors can perform all their timesheet and payroll processing tasks within the new application, eliminating the need for the old Google Sheet.

---

### **Epic 1: Payroll Page MVP & Workflow Alignment (Admin-Only Interface)**

This epic focuses on re-architecting the payroll page to directly mimic the simple, flat, and efficient workflow of the old Google Sheet, which was identified as a critical factor for user adoption. This will initially be built as an admin-only interface to achieve MVP faster.

#### **Issue #1.1: Re-architect Payroll Page to Mimic Google Sheet**

* **Title:** `[Feature] Rearchitect Payroll Page with Inline Editing and Newest-First View`
* **Description:** The current "Add Entry" drawer workflow is "not compatible" and "conflicting" (13:45, 15:48). This task is to replace it with a table-based interface that mimics the Google Sheet.
    * The page must display payroll entries in a table, sorted by date with the **newest entries on top** (15:20).
    * Implement an "Add Entry" button (e.g., a `+` icon) that adds a new, empty, editable row to the top of the table (15:34).
    * All fields in the row should be editable inline, removing the need for a separate drawer or page for creating/editing single entries.
* **Acceptance Criteria:**
    * The payroll page is a data table, not a list of cards.
    * Data is sorted by date in descending order by default.
    * A `+` button adds a new, editable row to the table.
    * User can click into cells (Date, Artist, Venue, etc.) and edit the data directly.
    * Changes are saved (either per-row on blur, or via a single "Save Changes" button).
* **Type:** `Feature` / `Refactor`
* **Assignee:** `[Frontend Dev Name]`
* **Labels:** `frontend`, `ui`, `payroll`, `refactor`, `high-priority`

#### **Issue #1.2: Research Rate Card Logic**

* **Title:** `[Spike] Analyze and Document the Rate Card Business Logic`
* **Description:** The pay calculation is complex. As noted (05:29, 06:11), the rate depends on program type (Healing Arts, etc.) and can be a standard hourly rate, a flat fee, or a "first hour fee + additional hour fee" structure. A "deep dive" is required before implementation (06:42).
* **Acceptance Criteria:**
    * A technical document is produced that clearly outlines all rate types and their calculation formulas.
    * The document specifies how `Location` (Venue) and its associated `Program Type` (e.g., 'Healing Arts') determine the applicable rates.
    * All predefined values from the old sheet's dropdowns (`Rate`, `Reason for Additional Pay`) are documented.
* **Type:** `Spike` / `Research`
* **Assignee:** `[Dev Name]`
* **Labels:** `research`, `spike`, `payroll`, `business-logic`

#### **Issue #1.3: Simplify Event Creation & Automate Payroll Entries**

* **Title:** `[Feature] Simplify Event Creation and Automate Payroll Entry Generation`
* **Description:** The new, preferred workflow involves creating an Event which then generates payroll entries. This flow is currently "not functioning" and needs to be "simplified, drastically" (17:02).
    * **Part 1 (Simplify):** The "Create Event" form should be minimal, requiring only essential info like a `Date` and `Location` (Venue), then flowing directly to `Artist Selection` (16:24).
    * **Part 2 (Automate):** After an event has occurred, the system should **automatically trigger the creation of the corresponding payroll entries** for each artist associated with that event (17:15).
    * **Part 3 (Tracking):** The resulting payroll entries need a new field/tag to indicate their origin: `created_by: 'event-automation'` or `created_by: '[user_name]'` for manual entries (17:24).
* **Acceptance Criteria:**
    * The create event flow is simplified and functional.
    * A backend process exists that, upon an event's completion, generates a payroll item for each linked artist.
    * The generated payroll entries are correctly populated with data from the event (Date, Venue, Artist).
    * A `source` or `creation_method` field is added to the payroll table and correctly identifies entries as 'automated' or 'manual'.
* **Type:** `Feature`
* **Assignee:** `[Backend Dev Name]`, `[Frontend Dev Name]`
* **Labels:** `backend`, `frontend`, `automation`, `events`, `workflow`

---

### **Epic 2: Foundational User Roles & Permissions**

This epic covers the foundational work of implementing a robust user role system, which is a prerequisite for securing the application and tailoring the user experience beyond the admin-only MVP.

#### **Issue #2.1: Backend Role Implementation**

* **Title:** `[Feature] Implement User Role System (Admin, Director, Staff) in Supabase`
* **Description:** As per the discussion (10:23), we need to create a three-tier user role system. This involves setting up the logic and permissions in our Supabase backend.
    * **Admin:** Can create, view, edit, and delete all other users (Admins, Directors, Staff).
    * **Director:** Can create, view, and edit Staff users. Cannot create Admins or other Directors.
    * **Staff:** Cannot create any other users.
* **Acceptance Criteria:**
    * Backend logic correctly enforces the creation permissions described above.
    * API endpoints for user management are protected and respect the permissions of the calling user.
    * A user's role is stored and retrievable via their profile.
* **Type:** `Feature`
* **Assignee:** `[Backend Dev Name]`
* **Labels:** `backend`, `auth`, `permissions`, `supabase`

#### **Issue #2.2: Admin "View As" Functionality**

* **Title:** `[Feature] Create 'View As' Toggle for Admins`
* **Description:** To facilitate testing and support, Admins need the ability to view the application as if they were another role (11:55). This must be clearly indicated in the UI.
* **Acceptance Criteria:**
    * An admin-only component exists in the UI (e.g., in the header) allowing them to select "View as Director" or "View as Staff".
    * When a view is selected, the entire application UI re-renders as if the admin were logged in with the selected role.
    * A persistent, color-coded banner appears at the top of the screen clearly stating "Viewing as Director" or "Viewing as Staff" to avoid confusion (12:16).
    * The admin can easily exit the "View As" mode and return to their full administrator privileges.
* **Type:** `Feature`
* **Assignee:** `[Frontend Dev Name]`
* **Labels:** `frontend`, `ui`, `admin-tools`

#### **Issue #2.3: RLE-Based Conditional UI (Backwards Compatibility)**

* **Title:** `[Feature] Implement RLE-Based Conditional UI Rendering for Backwards Compatibility`
* **Description:** The user interface must change dynamically based on the logged-in user's role to limit access and simplify the view (11:06). This provides backwards compatibility with the existing RLE (Role-Level Experience) system.
    * **Administrator:** Sees all UI elements and has access to all functionality.
    * **Director:** Sees most UI elements, with potential restrictions on application-level settings.
    * **Staff:** Sees a significantly simplified UI, primarily focused on their own tasks and entries.
* **Acceptance Criteria:**
    * Navigation menus and page components are conditionally rendered based on the user's role.
    * Actions (e.g., "Add User" button) are hidden or disabled if the user lacks permission.
    * The application correctly fetches the user's role on login and uses it to drive the UI state.
    * Backwards compatibility with existing RLE-based conditional UI patterns is maintained.
* **Type:** `Feature`
* **Assignee:** `[Frontend Dev Name]`
* **Labels:** `frontend`, `ui`, `permissions`, `backwards-compatibility`