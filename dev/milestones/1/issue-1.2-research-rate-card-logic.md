# Issue #2.2: Research Rate Card Logic

**Title:** `[Spike] Analyze and Document the Rate Card Business Logic`

**Epic:** Payroll Page MVP & Workflow Alignment

## Description

The pay calculation is complex. As noted (05:29, 06:11), the rate depends on program type (Healing Arts, etc.) and can be a standard hourly rate, a flat fee, or a "first hour fee + additional hour fee" structure. A "deep dive" is required before implementation (06:42).

## Acceptance Criteria

- [ ] A technical document is produced that clearly outlines all rate types and their calculation formulas
- [ ] The document specifies how `Location` (Venue) and its associated `Program Type` (e.g., 'Healing Arts') determine the applicable rates
- [ ] All predefined values from the old sheet's dropdowns (`Rate`, `Reason for Additional Pay`) are documented
- [ ] Create a mapping between venues and their program types
- [ ] Document all edge cases and special payment scenarios
- [ ] Provide clear formulas for each payment calculation type

## Research Tasks

### Rate Types to Document
1. Standard hourly rate (flat rate × hours)
2. First hour + additional hours structure
3. Flat fee payments
4. Special rates for different program types

### Program Type Mappings
- Healing Arts (Blue) - venues and rates
- Creative Placemaking (Yellow) - venues and rates
- Procedural (Gray) - venues and rates
- Other (Pink/Magenta) - venues and rates

### Additional Pay Reasons
Document all valid options:
- Project Leader
- Carthage
- Bank Deposit
- Travel Expenses
- Parking
- LLC
- Holiday Special Guest
- Half Pay
- Cancellation Fee
- Band Leader
- Arts Admin
- C-Notes

### Deliverables
1. Technical specification document
2. Rate calculation flowchart
3. Database schema recommendations for rate storage
4. Test cases for various payment scenarios

## Type
`Spike` / `Research`

## Labels
`research`, `spike`, `payroll`, `business-logic`

## Priority
High - Blocking accurate payroll calculations

## Estimated Effort
2-3 days

## Dependencies
- Access to current Google Sheet with rate card
- Stakeholder availability for clarification questions

## Notes
- This research is critical for implementing accurate payment calculations
- Consider edge cases like partial hours, overtime, holiday rates
- Document any manual overrides or exceptions currently in use
- Interview key users to understand undocumented business rules