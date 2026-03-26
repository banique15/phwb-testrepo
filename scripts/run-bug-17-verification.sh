#!/bin/bash

# Bug #17 Verification Runner
# This script runs all verification steps for Bug #17 fix

set -e  # Exit on any error

echo "=================================================="
echo "Bug #17 Verification - Testing Sessions Table Fix"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Run the automated verification script
echo -e "${YELLOW}Step 1: Running automated verification tests...${NC}"
echo ""
bun run scripts/verify-bug-17.ts
VERIFY_EXIT_CODE=$?

if [ $VERIFY_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Automated verification passed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Automated verification failed!${NC}"
    exit 1
fi

echo ""
echo "=================================================="
echo ""

# Step 2: Run TypeScript type checking
echo -e "${YELLOW}Step 2: Running TypeScript type checking...${NC}"
echo ""
bun run check
CHECK_EXIT_CODE=$?

if [ $CHECK_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Type checking passed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Type checking failed!${NC}"
    exit 1
fi

echo ""
echo "=================================================="
echo ""

# Step 3: Verify migration file format
echo -e "${YELLOW}Step 3: Verifying migration file format...${NC}"
echo ""

MIGRATION_FILE="migrations/013_create_bug_testing_sessions.sql"

if [ -f "$MIGRATION_FILE" ]; then
    echo "✓ Migration file exists: $MIGRATION_FILE"
    
    # Check file size
    FILE_SIZE=$(wc -c < "$MIGRATION_FILE")
    if [ $FILE_SIZE -gt 100 ]; then
        echo "✓ Migration file has content ($FILE_SIZE bytes)"
    else
        echo -e "${RED}✗ Migration file is too small ($FILE_SIZE bytes)${NC}"
        exit 1
    fi
    
    # Check for SQL syntax basics
    if grep -q "CREATE TABLE" "$MIGRATION_FILE"; then
        echo "✓ Contains CREATE TABLE statement"
    else
        echo -e "${RED}✗ Missing CREATE TABLE statement${NC}"
        exit 1
    fi
    
    if grep -q "phwb_bug_testing_sessions" "$MIGRATION_FILE"; then
        echo "✓ References correct table name"
    else
        echo -e "${RED}✗ Wrong table name${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ Migration file format is valid!${NC}"
else
    echo -e "${RED}✗ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo ""
echo "=================================================="
echo ""

# Final Summary
echo -e "${GREEN}🎉 All verification steps passed!${NC}"
echo ""
echo "Bug #17 fix is complete and verified."
echo ""
echo "Next steps:"
echo "1. Apply migration: supabase db push"
echo "2. Test bug detail page loads correctly"
echo "3. Test Testing tab functionality"
echo ""
echo "For detailed documentation, see:"
echo "  - scripts/BUG_17_VERIFICATION.md"
echo "  - BUG_17_FIX_SUMMARY.md"
echo ""
