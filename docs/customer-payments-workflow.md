# V1.4 Customer Payments Workflow

## Event flow

Accepted Quotation → Invoice → Payment Plan → Customer Payment → Receipt → Outstanding Balance

## Invoice

- Created only from an **Accepted** quotation.
- Copies the accepted quotation items and final amount.
- Uses numbering `DE-INV-YYYY-0001`.
- Tracks Invoice Total, Amount Paid, Outstanding and status.
- Status is automatically derived as Issued, Partially Paid, Paid or Overdue.

## Payment plans

Supported in V1.4:

- 50% Booking Advance / 50% Final Balance
- 30% Booking Advance / 70% Final Balance
- Custom milestones

The milestone amounts must equal the invoice total. A payment plan must be created before the first payment if milestones are required.

## Payments and receipts

- Finance Head records customer payments against the invoice.
- If a payment plan exists, each payment must be allocated to a milestone.
- A payment cannot exceed the selected milestone balance or the invoice outstanding balance.
- Each successful payment automatically creates:
  - a Payment record
  - an approved Income record
  - a branded Receipt
- Receipt numbering uses `DE-RCP-YYYY-0001`.
- The receipt shows the amount received and remaining invoice balance.

## Receivables

Once an event has an invoice, dashboard/event receivables are based on invoice outstanding rather than only confirmed event value.
