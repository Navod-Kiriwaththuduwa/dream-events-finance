# Dream Events Finance Platform — V1.3.2 Quotation Document Refinement

This update refines the customer quotation document only. It does not change the event budget hierarchy or quotation visibility rules.

## Changes

- Quotations now round monetary values to the nearest whole LKR so floating-point/cents artifacts do not appear in customer documents.
- Dream Events phone added: +94 70 628 0480.
- Quotation issue date is now shown in the document metadata.
- Improved spacing between quotation groups and service lines.
- Added an "Authorized by Dream Events" signature/authorization area.
- Improved A4 print CSS for long, multi-page quotations:
  - item rows are kept together where possible
  - section headings are kept with following content
  - totals, terms and authorization blocks avoid awkward page splitting
  - A4 page margins are handled by print CSS rather than a fixed one-page sheet height
- Company phone is stored in `assets/js/config.js` as `COMPANY_PHONE` for easier future changes.

## Manual GitHub update

Upload/replace these files in the existing repository:

- `assets/js/app.js`
- `assets/js/api.js`
- `assets/js/config.js`
- `assets/css/styles.css`
- `apps-script/Quotations.gs`

Suggested commit message:

`Refine quotation PDF layout and rounding`

After GitHub Pages deploys, refresh with Ctrl+F5.

## Expected rounding example

A quotation containing LKR 20,000.01 + LKR 15,000 + LKR 90,000 will display:

- Subtotal: LKR 125,000
- 5% discount: LKR 6,250
- Total: LKR 118,750
