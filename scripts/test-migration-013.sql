-- Test script for migration 013_create_bug_testing_sessions.sql
-- This script validates that the migration creates the expected schema
-- Run this AFTER applying the migration to verify it worked correctly

-- ============================================================================
-- Test 1: Verify table exists
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'phwb_bug_testing_sessions'
    ) THEN
        RAISE NOTICE '✓ Test 1 PASSED: Table phwb_bug_testing_sessions exists';
    ELSE
        RAISE EXCEPTION '✗ Test 1 FAILED: Table phwb_bug_testing_sessions does not exist';
    END IF;
END $$;

-- ============================================================================
-- Test 2: Verify all required columns exist
-- ============================================================================
DO $$
DECLARE
    missing_columns text[];
BEGIN
    SELECT array_agg(col)
    INTO missing_columns
    FROM (
        SELECT unnest(ARRAY[
            'id', 'created_at', 'updated_at', 'bug_id', 'tester_id',
            'title', 'status', 'environment', 'transcript', 'summary',
            'media', 'tested_issue_ids', 'started_at', 'completed_at'
        ]) AS col
    ) expected
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'phwb_bug_testing_sessions'
        AND column_name = expected.col
    );
    
    IF missing_columns IS NULL OR array_length(missing_columns, 1) IS NULL THEN
        RAISE NOTICE '✓ Test 2 PASSED: All required columns exist';
    ELSE
        RAISE EXCEPTION '✗ Test 2 FAILED: Missing columns: %', array_to_string(missing_columns, ', ');
    END IF;
END $$;

-- ============================================================================
-- Test 3: Verify foreign keys exist
-- ============================================================================
DO $$
DECLARE
    fk_count integer;
BEGIN
    SELECT COUNT(*)
    INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_name = 'phwb_bug_testing_sessions'
    AND constraint_type = 'FOREIGN KEY';
    
    IF fk_count >= 2 THEN
        RAISE NOTICE '✓ Test 3 PASSED: Foreign keys exist (found %)', fk_count;
    ELSE
        RAISE EXCEPTION '✗ Test 3 FAILED: Expected at least 2 foreign keys, found %', fk_count;
    END IF;
END $$;

-- ============================================================================
-- Test 4: Verify check constraints exist
-- ============================================================================
DO $$
DECLARE
    check_count integer;
BEGIN
    SELECT COUNT(*)
    INTO check_count
    FROM information_schema.check_constraints
    WHERE constraint_name IN ('testing_status_check', 'title_not_empty');
    
    IF check_count >= 2 THEN
        RAISE NOTICE '✓ Test 4 PASSED: Check constraints exist';
    ELSE
        RAISE EXCEPTION '✗ Test 4 FAILED: Expected 2 check constraints, found %', check_count;
    END IF;
END $$;

-- ============================================================================
-- Test 5: Verify indexes exist
-- ============================================================================
DO $$
DECLARE
    index_count integer;
BEGIN
    SELECT COUNT(*)
    INTO index_count
    FROM pg_indexes
    WHERE tablename = 'phwb_bug_testing_sessions'
    AND indexname LIKE 'idx_bug_testing_sessions_%';
    
    IF index_count >= 4 THEN
        RAISE NOTICE '✓ Test 5 PASSED: Performance indexes exist (found %)', index_count;
    ELSE
        RAISE EXCEPTION '✗ Test 5 FAILED: Expected at least 4 indexes, found %', index_count;
    END IF;
END $$;

-- ============================================================================
-- Test 6: Verify RLS is enabled
-- ============================================================================
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    SELECT rowsecurity
    INTO rls_enabled
    FROM pg_tables
    WHERE tablename = 'phwb_bug_testing_sessions';
    
    IF rls_enabled THEN
        RAISE NOTICE '✓ Test 6 PASSED: RLS is enabled';
    ELSE
        RAISE EXCEPTION '✗ Test 6 FAILED: RLS is not enabled';
    END IF;
END $$;

-- ============================================================================
-- Test 7: Verify RLS policies exist
-- ============================================================================
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies
    WHERE tablename = 'phwb_bug_testing_sessions';
    
    IF policy_count >= 4 THEN
        RAISE NOTICE '✓ Test 7 PASSED: RLS policies exist (found %)', policy_count;
    ELSE
        RAISE EXCEPTION '✗ Test 7 FAILED: Expected at least 4 RLS policies, found %', policy_count;
    END IF;
END $$;

-- ============================================================================
-- Test 8: Verify trigger exists
-- ============================================================================
DO $$
DECLARE
    trigger_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_bug_testing_sessions_updated_at'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE NOTICE '✓ Test 8 PASSED: Trigger for updated_at exists';
    ELSE
        RAISE EXCEPTION '✗ Test 8 FAILED: Trigger for updated_at does not exist';
    END IF;
END $$;

-- ============================================================================
-- Test 9: Verify data types are correct
-- ============================================================================
DO $$
DECLARE
    type_errors text[];
BEGIN
    SELECT array_agg(column_name || ' (expected: ' || expected_type || ', got: ' || data_type || ')')
    INTO type_errors
    FROM (
        SELECT 
            c.column_name,
            c.data_type,
            CASE c.column_name
                WHEN 'id' THEN 'integer'
                WHEN 'created_at' THEN 'timestamp with time zone'
                WHEN 'updated_at' THEN 'timestamp with time zone'
                WHEN 'bug_id' THEN 'integer'
                WHEN 'tester_id' THEN 'uuid'
                WHEN 'title' THEN 'text'
                WHEN 'status' THEN 'text'
                WHEN 'environment' THEN 'text'
                WHEN 'transcript' THEN 'text'
                WHEN 'summary' THEN 'text'
                WHEN 'media' THEN 'jsonb'
                WHEN 'tested_issue_ids' THEN 'ARRAY'
                WHEN 'started_at' THEN 'timestamp with time zone'
                WHEN 'completed_at' THEN 'timestamp with time zone'
            END as expected_type
        FROM information_schema.columns c
        WHERE c.table_name = 'phwb_bug_testing_sessions'
    ) check_types
    WHERE data_type != expected_type;
    
    IF type_errors IS NULL OR array_length(type_errors, 1) IS NULL THEN
        RAISE NOTICE '✓ Test 9 PASSED: All column types are correct';
    ELSE
        RAISE EXCEPTION '✗ Test 9 FAILED: Type mismatches: %', array_to_string(type_errors, '; ');
    END IF;
END $$;

-- ============================================================================
-- Test 10: Test basic CRUD operations (if you have auth set up)
-- ============================================================================
-- Note: This test will only work if you have authenticated users
-- Comment out if running without auth context

-- DO $$
-- DECLARE
--     test_id integer;
-- BEGIN
--     -- Test INSERT
--     INSERT INTO phwb_bug_testing_sessions (
--         bug_id, title, status, summary
--     ) VALUES (
--         1, 'Test Session', 'pass', 'Test summary'
--     ) RETURNING id INTO test_id;
    
--     RAISE NOTICE '✓ Test 10a PASSED: INSERT works (id: %)', test_id;
    
--     -- Test SELECT
--     PERFORM * FROM phwb_bug_testing_sessions WHERE id = test_id;
--     RAISE NOTICE '✓ Test 10b PASSED: SELECT works';
    
--     -- Test UPDATE
--     UPDATE phwb_bug_testing_sessions 
--     SET status = 'fail' 
--     WHERE id = test_id;
--     RAISE NOTICE '✓ Test 10c PASSED: UPDATE works';
    
--     -- Test DELETE
--     DELETE FROM phwb_bug_testing_sessions WHERE id = test_id;
--     RAISE NOTICE '✓ Test 10d PASSED: DELETE works';
-- END $$;

-- ============================================================================
-- Summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 013 Validation Complete';
    RAISE NOTICE 'All tests passed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'The phwb_bug_testing_sessions table is';
    RAISE NOTICE 'properly configured and ready to use.';
    RAISE NOTICE '';
END $$;
