# Dream Events Finance V1.5.2 - Expense Attachment Upload

This hotfix connects real receipt/bill uploads to Google Drive.

## Files included
- `assets/js/app.js` - frontend upload + View Attachment link
- `apps-script/Transactions.gs` - Google Drive upload + attachment database record

## What changes
- Expense receipt/bill is now uploaded as the actual file, not just a filename.
- Supports image files and PDFs up to 5 MB.
- Event expense files are saved under:
  `Dream Events Finance / Events / <Event ID> / Expense Proof`
- General business expense files are saved under:
  `Dream Events Finance / Business Expenses / <Year>`
- `17_EXPENSES.Attachment_URL` is populated.
- A row is created in `27_ATTACHMENTS` with Drive file ID/URL and upload details.
- Expense lists show a `View attachment` link when a file exists.
- Files remain private in Google Drive; this hotfix does not make receipts public.

## Installation
1. In GitHub, replace `assets/js/app.js` with the included file.
2. Also replace `apps-script/Transactions.gs` in GitHub so the repository stays synchronized.
3. In your Google Apps Script project, open `Transactions.gs` and replace its complete contents with the included `apps-script/Transactions.gs`.
4. Save the Apps Script project.
5. Deploy -> Manage deployments -> Edit -> New version.
6. Description: `V1.5.2 expense attachment upload`.
7. Keep Execute as: Me and Who has access: Anyone.
8. Deploy.
9. Refresh the GitHub Pages app with Ctrl+Shift+R.

DO NOT run `setupDreamEvents()` again. No database reset or schema change is required.

## Test
Create one new expense with a small JPG/PNG/PDF attachment. Then verify:
- Expense row shows `View attachment`.
- `17_EXPENSES` has a value in `Attachment_URL`.
- `27_ATTACHMENTS` has a new row.
- Google Drive contains the actual file in the correct Expense Proof / Business Expenses folder.

Existing expenses created before this hotfix will not gain their previously selected files automatically; those files were never uploaded and must be attached again later if needed.
