# Plan for Implementing the FY25 Rate Card

## 1. Introduction

This document outlines the plan for implementing the new FY25 Rate Card into our payroll system. The current system, based on parsing simple rate strings, is not sufficient to handle the complexity of the new rate card, which includes different rates based on program type, ensemble size, and other factors.

## 2. Analysis of the New Rate Card

The new rate card is provided as an HTML file (`FY25-rate-card.html`). It is a Google Sheet export with a complex structure. The key information to be extracted is:

*   **Program Types:** Healing Arts, Creative Placemaking, Procedural, and Other.
*   **Rate Tiers:** Solo, Duo, Trio, Quartet, and other special rates.
*   **Rate Values:** The specific dollar amounts for each combination of program type and rate tier.
*   **Additional Pay:** Reasons for additional pay, such as "Project Leader," "Travel Expenses," etc.

A parsing script will be developed to extract this information from the HTML file and convert it into a structured format (e.g., JSON).

## 3. Proposed Data Model

To support the new rate card, we will need to update our data model. The following changes are proposed:

*   **`rate_cards` table:** A new table to store the different rate cards. This will allow us to easily switch between different rate cards in the future.
*   **`rate_rules` table:** A new table to store the specific rate rules. Each rule will define a rate for a specific combination of program type, rate tier, and any other conditions.
*   **`program_types` table:** A new table to store the different program types.
*   **`rate_tiers` table:** A new table to store the different rate tiers.
*   **`additional_pay_reasons` table:** A new table to store the reasons for additional pay.

This new data model will provide a flexible and scalable way to manage the rate card information.

## 4. Implementation Plan

The implementation will be divided into the following phases:

### Phase 1: Data Model and API

*   Implement the new database tables.
*   Create an API for managing the rate card data. This will include endpoints for creating, reading, updating, and deleting rate cards, rate rules, program types, rate tiers, and additional pay reasons.
*   Create a script to parse the `FY25-rate-card.html` file and populate the new database tables.

### Phase 2: Rate Calculation Engine

*   Update the `rateParser.ts` file to use the new rate card data from the API.
*   Update the `calculateTotalPay` function to use the new rate rules to calculate the total pay. This will involve looking up the correct rate based on the program type, rate tier, and any other conditions.

### Phase 3: UI/UX

*   Update the payroll page to display the new rate card information.
*   Update the timesheet import process to use the new rate card data.
*   Provide a way for users to select the correct program type and rate tier when creating or editing a timesheet entry.

## 5. Migration Plan

*   The existing timesheet data will need to be migrated to the new system. This will involve mapping the old rate strings to the new rate rules.
*   A script will be developed to automate this process as much as possible.

## 6. Testing

*   Thorough testing will be required to ensure that the new rate card is implemented correctly.
*   This will include unit tests for the new API and rate calculation engine, as well as end-to-end testing of the entire payroll process.

## 7. Rollout

*   The new rate card will be rolled out in a phased approach.
*   Initially, it will be used for a small group of users to identify and fix any issues.
*   Once it has been proven to be stable, it will be rolled out to all users.
