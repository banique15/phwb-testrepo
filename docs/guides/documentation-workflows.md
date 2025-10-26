# Documentation Workflow Guide

**Status**: [Complete]  
**Priority**: [High]  
**Owner**: Development Team  
**Created**: 2024-12-24  
**Last Updated**: 2024-12-24  
**Version**: 1.0.0

---

## 🎯 Quick Start Guide

### Creating New Documentation

1. **Choose Template**
   ```bash
   # For comprehensive docs
   cp docs/templates/TEMPLATE.md docs/[category]/YOUR_DOC.md
   
   # For task tracking
   cp docs/templates/CHECKLIST_TEMPLATE.md docs/[category]/YOUR_CHECKLIST.md
   ```

2. **Fill Required Fields**
   - Update status, priority, owner, and dates
   - Fill in the overview and content sections
   - Set up progress tracking with checkboxes

3. **Add to Registry**
   - Update `docs/README.md` document registry table
   - Link from relevant sections

---

## 📁 Directory Organization

```
docs/
├── templates/          # Document templates
│   ├── TEMPLATE.md                 # Standard doc template
│   └── CHECKLIST_TEMPLATE.md       # Task checklist template
├── planning/           # Project planning docs
│   ├── OPTIMIZE.md                 # Optimization planning
│   └── roadmap.md                  # Feature roadmaps
├── architecture/       # Technical architecture
│   ├── system-design.md            # System architecture
│   └── database-schema.md          # Database design
├── testing/           # Testing strategies
│   ├── TESTS.md                   # Testing plan
│   └── test-automation.md         # Test automation
├── performance/       # Performance docs
│   ├── PERFORMANCE_OPTIMIZATIONS.md
│   └── benchmarks.md              # Performance benchmarks
├── guides/            # How-to guides
│   ├── DOCUMENTATION_WORKFLOW.md  # This guide
│   └── onboarding.md              # Team onboarding
└── scripts/           # Automation scripts
    └── doc-status.py              # Status tracking script
```

---

## 🏷️ Document Categories & Naming

### Naming Conventions
- **Planning Docs**: `FEATURE_PLAN.md`, `ROADMAP_2024.md`
- **Architecture**: `SYSTEM_DESIGN.md`, `API_SPECIFICATION.md`
- **Testing**: `TEST_STRATEGY.md`, `AUTOMATION_PLAN.md`
- **Performance**: `OPTIMIZATION_PLAN.md`, `BENCHMARKS.md`
- **Guides**: `WORKFLOW_GUIDE.md`, `SETUP_GUIDE.md`

### Required Prefixes
- `TEMPLATE_` - Document templates
- `STATUS_` - Auto-generated status reports
- `CHECKLIST_` - Task tracking checklists

---

## 🔄 Status Management

### Document Status Lifecycle
```
Draft → In Progress → Under Review → Complete → Archived
   ↓         ↓            ↓           ↓         ↓
 Initial   Active      Ready for   Approved   No longer
 creation  development  approval   & live     active
```

### Priority Levels
- **P0 - Critical**: Security, blocking issues, core requirements
- **P1 - High**: Important features, significant user impact
- **P2 - Medium**: Improvements, optimizations, nice-to-haves
- **P3 - Low**: Future enhancements, documentation improvements

### Progress Tracking
Use checkbox format for tasks:
```markdown
- [ ] Task not started
- [x] Task completed
```

Update progress dashboard:
```markdown
**Overall Progress**: [75%] 🔄
**Critical Items Complete**: [3/4] ✅
```

---

## 📊 Task Organization System

### Priority-Based Task Structure
```markdown
## 🚨 P0 - Critical (Must Have)
- [ ] [Task] - Owner: [Name] - Due: [Date]

## 🔥 P1 - High (Should Have)  
- [ ] [Task] - Owner: [Name] - Due: [Date]

## 📊 P2 - Medium (Nice to Have)
- [ ] [Task] - Owner: [Name] - Due: [Date]

## 🎨 P3 - Low (Future Enhancement)
- [ ] [Task] - Owner: [Name] - Due: [Date]
```

### Task Format Standards
Each task should include:
- Clear, actionable description
- Assigned owner
- Target completion date
- Dependencies (if any)

Example:
```markdown
- [ ] Implement user authentication - Owner: Jane Doe - Due: 2024-01-15
  - Depends on: Database schema completion
  - Acceptance criteria: Users can login/logout securely
```

---

## 🛠️ Automation Tools

### Status Tracking Script
```bash
# Generate status report using Bun
bun docs:status

# Or run directly
bun run docs/scripts/doc-status.ts

# Output: docs/STATUS_REPORT.md with current progress
```

### Package.json Scripts
```bash
# Documentation commands
bun docs:status  # Generate status report
bun docs:help    # Show available documentation commands
```

### Git Hooks (Recommended)
```bash
# Pre-commit hook to update "Last Updated" dates
#!/bin/sh
find docs -name "*.md" -exec sed -i 's/Last Updated.*$/Last Updated**: '$(date +%Y-%m-%d)'/' {} \;
```

### Weekly Status Reports
Set up automated weekly reports:
```bash
# Cron job to generate weekly status using Bun
0 9 * * MON cd /path/to/project && bun docs:status
```

---

## ✅ Quality Checklist

### Before Publishing Document
- [ ] **Template Used**: Document follows standard template
- [ ] **Metadata Complete**: Status, priority, owner, dates filled
- [ ] **Progress Dashboard**: Current status clearly indicated
- [ ] **Tasks Organized**: Tasks properly categorized by priority
- [ ] **Links Working**: All internal/external links functional
- [ ] **Grammar/Spelling**: Content proofread and clean
- [ ] **Registry Updated**: Document added to main registry

### For Major Updates
- [ ] **Version Incremented**: Version number updated appropriately
- [ ] **Change Log Updated**: Changes documented in change log
- [ ] **Stakeholders Notified**: Relevant team members informed
- [ ] **Dependencies Checked**: Related documents updated if needed

---

## 🔍 Review Process

### Peer Review Checklist
- [ ] **Content Accuracy**: Technical details verified
- [ ] **Completeness**: All required sections present
- [ ] **Clarity**: Information easy to understand
- [ ] **Actionability**: Tasks clearly defined and achievable
- [ ] **Formatting**: Consistent with template standards

### Approval Workflow
1. **Author** creates/updates document
2. **Peer Review** by team member
3. **Technical Review** by lead developer
4. **Stakeholder Review** by product owner (if needed)
5. **Final Approval** and status update

---

## 📈 Best Practices

### Writing Effective Documentation
- **Be Specific**: Use concrete examples and clear acceptance criteria
- **Keep Current**: Update documents as requirements change
- **Link Liberally**: Connect related documents and code references
- **Use Visuals**: Include diagrams, screenshots, flowcharts
- **Write for Audience**: Consider who will read and use the document

### Task Management
- **Break Down Large Tasks**: Split complex tasks into smaller, manageable pieces
- **Set Realistic Deadlines**: Allow buffer time for unexpected complexity
- **Track Dependencies**: Note what blocks task completion
- **Update Regularly**: Mark completed tasks promptly
- **Celebrate Progress**: Acknowledge completed milestones

### Maintenance
- **Monthly Reviews**: Check all documents for currency
- **Quarterly Audits**: Review overall documentation structure
- **Archive Outdated**: Move old documents to archive folder
- **Update Templates**: Improve templates based on usage patterns

---

## 🆘 Troubleshooting

### Common Issues

**Problem**: Document not showing in status reports
- **Solution**: Ensure metadata follows exact template format
- **Check**: Status, Priority, Last Updated fields properly formatted

**Problem**: Tasks not counting in progress tracking
- **Solution**: Use exact checkbox format `- [ ]` and `- [x]`
- **Check**: No extra spaces or characters in checkbox syntax

**Problem**: Links broken after moving documents
- **Solution**: Use relative paths from repository root
- **Update**: All references in other documents

**Problem**: Template fields not clear
- **Solution**: Refer to examples in existing documents
- **Ask**: Documentation maintainer for guidance

---

## 🔗 Quick Reference

### Essential Commands
```bash
# Create new doc from template
cp docs/templates/TEMPLATE.md docs/category/NEW_DOC.md

# Generate status report using Bun
bun docs:status

# Show documentation help
bun docs:help

# Find documents by status
grep -r "Status.*Complete" docs/

# List all incomplete tasks
grep -r "- \[ \]" docs/
```

### Markdown Quick Reference
```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
`Code text`

[Link text](url)
![Image alt](image-url)

- [ ] Unchecked task
- [x] Checked task

| Table | Header |
|-------|--------|
| Cell  | Cell   |
```

---

## 📞 Getting Help

### Contact Points
- **Documentation Questions**: Create issue with `documentation` label
- **Template Issues**: Contact documentation maintainer
- **Process Suggestions**: Submit PR with proposed changes
- **Urgent Updates**: Slack #documentation channel

### Resources
- [Markdown Guide](https://www.markdownguide.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
- [Mermaid Diagrams](https://mermaid.js.org/)
- [Documentation Templates](templates/)

---

*This workflow guide is maintained by the development team. Please keep it updated as the documentation process evolves.*