# Payment Processing Workflow Documentation

## Overview

The PHWB Admin payment processing workflow provides a comprehensive system for managing payment approvals, batch processing, reconciliation, and audit trails for artist and venue payments.

## Workflow States

The payment workflow follows these status transitions:

1. **Planned** → Initial state when payment is created
2. **Approved** → Payment has been reviewed and approved for processing
3. **Paid** → Payment has been processed and sent
4. **Completed** → Payment has been reconciled with external systems
5. **Cancelled** → Payment was cancelled and will not be processed

## Key Components

### PaymentApprovalModal
- Review and approve planned payments
- Add approval notes and select payment method
- Bulk approval of multiple payments
- Validates that only "Planned" status payments can be approved

### PaymentBatchProcessor
- Process multiple approved payments together
- Create payment batches with metadata
- Auto-generate batch names with timestamps
- Track batch processing for audit purposes

### PaymentExport
- Export payment data in multiple formats:
  - **CSV**: Standard comma-separated values
  - **Excel**: CSV with UTF-8 BOM for Excel compatibility
  - **JSON**: Structured data for APIs
  - **Insperity**: Specific format for Insperity payroll system
- Configurable field inclusion and filtering
- Preview functionality before export

### PaymentReconciliation
- Match processed payments with external payment confirmations
- Single or bulk reconciliation modes
- Track external payment IDs and reconciliation notes
- Search and filter unreconciled payments

### PaymentAuditLog
- Complete audit trail for all payment actions
- Track user, timestamp, and details for each change
- Visual activity timeline with action icons
- Support for field-level change tracking

### PaymentStatusBadge
- Visual status indicators with appropriate colors and icons
- Consistent status display across the application
- Configurable sizes (xs, sm, md, lg)

## Database Schema

### phwb_payroll (Enhanced)
Key fields added for payment workflow:
- `approved_by` - User who approved the payment
- `approved_at` - Timestamp of approval
- `payment_method` - Method used for payment (check, ACH, wire, etc.)
- `payment_reference` - Reference number for tracking
- `external_payment_id` - ID from external payment system
- `processed_by` - User who processed the payment
- `processed_at` - Timestamp of processing
- `reconciled` - Boolean flag for reconciliation status
- `reconciled_at` - Timestamp of reconciliation
- `batch_id` - Reference to payment batch

### phwb_payment_batches (New)
Tracks payment batches:
- `id` - UUID for batch identification
- `batch_name` - Human-readable batch name
- `created_by` - User who created the batch
- `status` - Batch status (draft, submitted, processing, completed, failed)
- `total_amount` - Total amount of all payments in batch
- `payment_count` - Number of payments in batch
- `payment_method` - Payment method for all payments in batch
- `description` - Optional batch description
- `processed_at` - Timestamp when batch was processed
- `external_reference` - Reference in external system

### phwb_payroll_audit (New)
Comprehensive audit logging:
- `payroll_id` - Reference to payment entry
- `user_id` - User who performed the action
- `action` - Type of action (create, update, approve, process, reconcile, etc.)
- `previous_values` - JSON of values before change
- `new_values` - JSON of values after change
- `notes` - Optional notes about the action
- `ip_address` - User's IP address
- `user_agent` - User's browser information

## Insperity Integration

The Insperity export format includes specific columns required by the Insperity payroll system:

- **Employee ID**: Artist identifier
- **Employee Name**: Full name from artist profile
- **Pay Period Start/End**: Event date (same for both)
- **Hours**: Hours worked
- **Rate**: Hourly rate
- **Gross Pay**: Total payment amount
- **Pay Code**: REG for performance, OTH for other types
- **Department**: Always "ARTS"
- **Cost Center**: Venue name or "DEFAULT"
- **Reference**: Payment reference or batch ID
- **Earnings Type**: "Salary" for employees, "Contract" for contractors
- **Additional Pay**: Any additional payment amount
- **Additional Pay Reason**: Reason for additional payment
- **Check Date**: Date payment was processed
- **Status**: Current payment status

## Usage Examples

### Approve Multiple Payments
1. Select payments from the payroll list
2. Click "Payment Tools" → "Approve Payments"
3. Review payment details and add approval notes
4. Select preferred payment method
5. Click "Approve" to process

### Process Payment Batch
1. Select approved payments
2. Click "Payment Tools" → "Process Batch"
3. Configure batch name and payment method
4. Add external reference if needed
5. Click "Process" to create batch and update payment status

### Export for Insperity
1. Click "Payment Tools" → "Export Data"
2. Select "Insperity Format"
3. Configure filters (status, date range, etc.)
4. Choose field inclusion options
5. Click "Export" to download CSV file

### Reconcile Payments
1. Click "Payment Tools" → "Reconcile"
2. Search and filter unreconciled payments
3. Enter external payment IDs and notes
4. Use single or bulk reconciliation mode
5. Complete reconciliation to mark as "Completed"

## Security & Permissions

- All payment actions are logged in the audit trail
- User authentication required for all operations
- IP address and user agent tracking for security
- Approval workflow prevents unauthorized payment processing
- Audit logs are immutable once created

## Best Practices

1. **Always review** payment details before approval
2. **Use batch processing** for efficiency when processing multiple payments
3. **Include external references** for easier reconciliation
4. **Reconcile payments promptly** after processing
5. **Export regularly** for backup and external system integration
6. **Monitor audit logs** for security and compliance
7. **Use descriptive batch names** for easier tracking