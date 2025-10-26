# [Feature] Simplify Event Creation and Automate Payroll Entry Generation

**Epic:** Payroll Page MVP & Workflow Alignment

## 1. Overview

This document outlines the implementation plan for a new, simplified workflow for event creation and automated payroll generation. The goal is to streamline the process by creating an event with minimal information, which then automatically generates the necessary payroll entries for the artists involved. This addresses the need to simplify the "not functioning" flow and make it a core part of the application's workflow.

## 2. Core Components

The project is divided into three main components:

1.  **Simplified Event Creation:** A streamlined UI for creating events, requiring only essential information upfront.
2.  **Automated Payroll Generation:** A backend process to automatically create payroll entries from completed events.
3.  **Source Tracking:** A mechanism to track whether payroll entries were generated automatically or created manually.

## 3. Implementation Plan

### Phase 1: Backend - Database and API Updates

*   ~~**Task 1.1: Update Database Schema**~~
    *   ~~In the `phwb_payroll` table, add the following columns to track the origin of each entry:~~
        *   ~~`created_by VARCHAR(50)`: Stores the username for manual entries.~~
        *   ~~`creation_method ENUM('manual', 'event-automation')`: Identifies the creation method.~~
        *   ~~`source_event_id UUID REFERENCES phwb_events(id)`: Links the payroll entry to the source event.~~

*   **Task 1.2: Create API Endpoints for Simplified Event Creation**
    *   `POST /api/events`: An endpoint to create a new event with minimal data (e.g., `date`, `venueId`, optional `title`).
    *   `POST /api/events/{id}/artists`: An endpoint to associate multiple artists with an event in a single call.

*   **Task 1.3: Develop Payroll Automation Logic**
    *   Implement a scheduled Supabase function (or a similar trigger-based mechanism) that runs periodically (e.g., daily).
    *   The function will query for events that have recently concluded and do not yet have associated payroll entries.
    *   For each event, the function will:
        1.  Iterate through the list of assigned artists.
        2.  Create a new payroll entry for each artist.
        3.  Populate the entry with data from the event (date, venue, artist).
        4.  Apply default hours and rates based on the new rate card logic (dependency on **Issue #2.2**).
        5.  Set the `creation_method` to `'event-automation'` and `source_event_id` to the event's ID.
    *   Implement robust error handling and logging for the automation process.

### Phase 2: Frontend - UI/UX Implementation

*   **Task 2.1: Build the Simplified Event Creation Form**
    *   Create a new Svelte component for a streamlined event creation modal or page.
    *   The form will only require `Date` and `Venue` as mandatory fields, with `Title` being optional.
    *   On submission, this form will call the new `POST /api/events` endpoint.

*   **Task 2.2: Implement the Artist Selection UI**
    *   After an event is created, the user should be seamlessly guided to an artist selection interface.
    *   This interface must be optimized for quickly selecting multiple artists from a list.
    *   Upon confirmation, it will call the `POST /api/events/{id}/artists` endpoint to link the selected artists to the event.

*   **Task 2.3: Update Payroll UI for Source Tracking**
    *   Add a new column or indicator to the payroll data table to display the `creation_method`.
    *   Visually distinguish between `'automated'` and `'manual'` entries (e.g., using icons or text labels). For manual entries, show the `created_by` username.

### Phase 3: Manual Payroll Entry and Fallbacks

*   **Task 3.1: Update Manual Payroll Entry Form**
    *   Modify the existing manual payroll entry form to set the `creation_method` to `'manual'` and populate the `created_by` field with the current user's identifier.

*   **Task 3.2: (Optional) Manual Generation Button**
    *   As a fallback, consider adding a "Generate Payroll Entries" button on the event details page. This would allow users to manually trigger the payroll generation process for a specific event if the automation fails or needs to be expedited.

## 4. Dependencies

*   **Issue #2.2 (Rate Card Logic):** The payroll automation logic is critically dependent on the new rate card system to apply correct default rates. The implementation of the rate card API and logic should be completed before or in parallel with **Phase 1, Task 1.3**.

## 5. Testing Plan

*   **Backend:**
    *   Write unit tests for the payroll generation function, covering various scenarios (e.g., different program types, artist counts).
    *   Develop integration tests for the new API endpoints to ensure they handle data correctly.
*   **Frontend:**
    *   Create component tests for the new event creation form and the artist selection UI.
*   **End-to-End:**
    *   Conduct thorough end-to-end testing of the entire workflow: create an event, assign artists, wait for the automation to run, and verify the correctness of the generated payroll entries.
    *   Test edge cases, including event cancellations, artist changes post-event, and automation failures.
