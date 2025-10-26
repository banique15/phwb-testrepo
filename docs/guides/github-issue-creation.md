
## GitHub Issue Creation Standards

When creating GitHub issues for this project, follow these standards to ensure consistency, clarity, and Claude Code compatibility.

### Issue Template Structure

All issues must follow this structure:

```markdown
## Overview
[Brief description of the feature/bug/task - 1-2 sentences]

## Current State Analysis
[Analysis of existing codebase patterns, affected files, and relevant context]

## Requirements
[Detailed requirements using checkboxes for trackable tasks]
- [ ] Requirement 1
- [ ] Requirement 2

## Implementation Details
[Technical specifications, file locations, API changes, etc.]

### Files to Create/Modify
```
path/to/file1.ext    # Description
path/to/file2.ext    # Description
```

## Acceptance Criteria
[Clear, testable criteria for completion]
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
[Architecture considerations, dependencies, edge cases]

---
@claude
```

### Required Labels

Every issue must have appropriate labels from these categories:

**Type Labels** (required - exactly one):
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `refactor` - Code improvement without feature changes
- `documentation` - Documentation updates

**Area Labels** (required - one or more):
- `ui/ux` - User interface/experience changes
- `authentication` - Auth-related changes
- `crud` - Create/Read/Update/Delete operations
- `forms` - Form-related functionality
- `profile` - User profile management
- `user management` - User administration features

**Priority Labels** (optional):
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed

### Issue Title Standards

- Use clear, descriptive titles without emojis
- Start with action verb (Add, Fix, Update, Refactor, etc.)
- Include affected component/feature
- Examples:
  - "Add toast notification system for CRUD operations"
  - "Fix user profile update validation errors"
  - "Refactor Edit components with tabbed interface"

### MCP Tool Usage for Issue Creation

When using GitHub CLI (`gh`) to create issues:

```bash
# Create issue with proper labels and body
gh issue create \
  --repo singforhope/phwb \
  --title "Add feature name here" \
  --label "enhancement,ui/ux,forms" \
  --body "$(cat <<'EOF'
[Full issue template content here]
@claude
EOF
)"
```

### Claude Integration Requirements

Every issue body must end with `@claude` to enable automatic assignment and processing.

### Pre-Creation Checklist

Before creating an issue:
- [ ] Analyze affected files and components
- [ ] Review existing similar functionality
- [ ] Identify all files that need modification
- [ ] Define clear acceptance criteria
- [ ] Add appropriate labels
- [ ] Include `@claude` mention