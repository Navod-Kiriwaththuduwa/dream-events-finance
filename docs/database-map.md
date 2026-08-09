# Database map

The Apps Script setup creates one master workbook with sheets `00_SETTINGS` through `30_SESSIONS`.

## Tables used now

- `00_SETTINGS` — company/system configuration
- `01_USERS` — users, role, password hash/salt, lockout state
- `02_CUSTOMERS` — customer master
- `03_EVENTS` — event master and editable event details
- `05_BUDGET_HEADERS` — one active budget header/version per event
- `06_BUDGET_LINES` — Main / Sub / Detailed budget hierarchy
- `16_INCOME` — income submissions
- `17_EXPENSES` — expense submissions, approval state, and optional `Budget_Line_ID` link to actual budget
- `20_PAYABLES` — supplier/owner/team liabilities
- `28_AUDIT_LOG` — controlled activity history
- `29_COUNTERS` — duplicate-safe document/record numbering
- `30_SESSIONS` — hashed login session tokens

## Reserved V1 tables

Budget templates: `07_PACKAGES`, `08_PACKAGE_LINES`

Sales documents: `09_QUOTATIONS`, `10_QUOTATION_LINES`, `11_INVOICES`, `12_INVOICE_LINES`, `13_PAYMENT_PLANS`, `14_PAYMENTS`, `15_RECEIPTS`

Finance: `18_REFUNDS`, `19_SUPPLIERS`, `21_REIMBURSEMENTS`

Inventory/labour: `22_INVENTORY`, `23_INVENTORY_ALLOCATIONS`, `24_INVENTORY_TRANSACTIONS`, `25_STAFF`, `26_EVENT_LABOUR`

Files: `27_ATTACHMENTS`

## V1.4 customer finance additions

The V1.4 invoice/payment flow uses the previously reserved finance sheets:

- `11_INVOICES` — invoice header and balance/status
- `12_INVOICE_LINES` — frozen customer-facing invoice lines copied from accepted quotation
- `13_PAYMENT_PLANS` — invoice-linked milestone rows
- `14_PAYMENTS` — approved customer payments
- `15_RECEIPTS` — receipt number, payment link and remaining balance
- `16_INCOME` — each invoice payment also creates an approved income record with Invoice_ID and Receipt_ID

V1.4 adds `Invoice_ID` and `Plan_Type` to payment-plan rows and Main/Sub hierarchy fields to invoice lines so the printed invoice preserves quotation grouping.
