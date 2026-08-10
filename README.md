# Dream Events Finance V1.5.3 — Payment Speed & Timeout Fix

This package fixes the Payments tab timeout without changing the database or existing payment records.

## Files

### GitHub Pages
Replace/upload:
- `index.html`
- `assets/js/api-hotfix.js` (new file)

The hotfix gives every backend request its own hidden iframe, so simultaneous requests no longer overwrite each other. It also combines the four payment-data requests (invoices, plans, payments, receipts) into one lightweight backend request.

### Google Apps Script
Replace:
- `Payments.gs`

Then deploy a **new Web App version**. Do not run `setupDreamEvents()`.

## Deployment
1. Save Apps Script.
2. Deploy → Manage deployments → Edit.
3. Version → New version.
4. Description: `V1.5.3 payment speed timeout fix`.
5. Execute as: Me.
6. Who has access: Anyone.
7. Deploy.
8. Upload the GitHub files and commit.
9. Wait for GitHub Pages, then hard refresh with Ctrl+Shift+R.

## Test
Open an event → Payments. It should load through one payment workspace request plus the quotation request, instead of five competing requests.

Important: if a Record Payment action ever times out, check payment history / `14_PAYMENTS` before submitting it again.
