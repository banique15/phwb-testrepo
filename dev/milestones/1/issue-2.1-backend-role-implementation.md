# Issue #1.1: Backend Role Implementation

**Title:** `[Feature] Implement User Role System (Admin, Director, Staff) in Supabase`

**Epic:** Foundational User Roles & Permissions

## Description

As per the discussion (10:23), we need to create a three-tier user role system. This involves setting up the logic and permissions in our Supabase backend.

### Role Definitions:
- **Admin:** Can create, view, edit, and delete all other users (Admins, Directors, Staff)
- **Director:** Can create, view, and edit Staff users. Cannot create Admins or other Directors
- **Staff:** Cannot create any other users

## Acceptance Criteria

- [ ] Backend logic correctly enforces the creation permissions described above
- [ ] API endpoints for user management are protected and respect the permissions of the calling user
- [ ] A user's role is stored and retrievable via their profile
- [ ] Role-based Row Level Security (RLS) policies are implemented in Supabase
- [ ] Authentication hooks validate role permissions on user management operations

## Technical Details

### Database Schema Changes
- Add `role` column to user profiles table with enum values: 'admin', 'director', 'staff'
- Create RLS policies for user CRUD operations based on roles

### API Endpoints
- `/api/users` - List users (filtered by role permissions)
- `/api/users/create` - Create new user (validated by role)
- `/api/users/[id]` - Update/delete user (validated by role)

## Type
`Feature`

## Labels
`backend`, `auth`, `permissions`, `supabase`

## Priority
High - This is a foundational requirement for the entire permission system

## Estimated Effort
3-5 days

## Dependencies
- Supabase project setup
- Existing authentication system

## Notes
- This is a prerequisite for securing the application and must be completed before other role-based features
- Consider future scalability if more roles are needed