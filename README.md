# Dream Events Finance V1.6.0 — Suppliers, Payables & Inventory

This update adds:
- Supplier master
- Supplier selection for Credit / Pay Later expenses
- Supplier / Owner / Team payables
- Payable settlement and reimbursement history
- Payable due dates
- Reusable inventory master
- Inventory allocation to events
- Internal cost per event/use
- Default customer charge per use
- Inventory return tracking

It keeps the existing V1.5.3 payment hotfix and the expense attachment upload.

## GitHub files

Upload / replace:

- `index.html` — replace
- `assets/js/ops.js` — new file
- `apps-script/Code.gs` — replace the GitHub copy
- `apps-script/Transactions.gs` — replace the GitHub copy
- `apps-script/Ops.gs` — new file

Do not remove:
- `assets/js/api-hotfix.js`
- your existing `assets/js/app.js`

## Google Apps Script

1. Replace `Code.gs` with the file from this package.
2. Replace `Transactions.gs` with the file from this package.
3. Create a new Apps Script file named `Ops.gs`.
4. Paste the package `Ops.gs` into it.
5. Save.
6. Deploy → Manage deployments → Edit → New version.
7. Description: `V1.6 suppliers payables inventory`
8. Keep Execute as: Me.
9. Keep Who has access: Anyone.
10. Deploy.

Do NOT run `setupDreamEvents()` again. The required sheets already exist:
`19_SUPPLIERS`, `20_PAYABLES`, `21_REIMBURSEMENTS`, `22_INVENTORY`,
`23_INVENTORY_ALLOCATIONS`, and `24_INVENTORY_TRANSACTIONS`.

## Test order

1. Open Suppliers → create one supplier.
2. Add Expense → choose Credit / Pay Later → choose the supplier → submit.
3. Open Payables → verify the supplier payable appears.
4. Record a partial or full settlement.
5. Open Inventory → create one reusable item.
6. Allocate it to an event.
7. Verify Available quantity decreases.
8. Mark Returned and verify Available quantity increases again.

Existing records are not deleted or reset.
