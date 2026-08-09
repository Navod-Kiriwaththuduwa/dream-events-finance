# Dream Events Finance Platform

Version 1.1 foundation for Dream Events: a responsive finance and event-management web app designed for GitHub Pages with Google Apps Script + Google Sheets + Google Drive as the business backend.

## Included in this milestone

- Finance Head and Team Member roles
- Username/password login backend with salted iterative hashing, lockout and session tokens
- Responsive dashboard
- Customer creation/search
- Event creation/search
- Income entry
- Expense entry
- Finance Head expense approval/rejection
- Owner/team-member personal funding automatically represented as payables after approval
- Google Sheets database generator covering the full agreed V1 data model
- Google Drive root/event folder creation
- Audit log foundation
- Document/counter tables reserved for quotation, invoice, receipt, refund, inventory and reporting phases
- Demo mode so the interface can be tested before Google deployment

## Demo

Open `index.html` through a local/static web server or GitHub Pages.

- Finance Head: `finance` / `demo123`
- Team Member: `team` / `demo123`

Demo data is stored in browser localStorage only. It is not production data.


## V1.1 budget engine update

This package now also includes:

- Editable event details after creation
- Event detail workspace with Overview / Budget / Expenses / Income tabs
- Finance Head-only hierarchical budget planner: Main Item → Sub Item → Detailed Item
- Estimated quantity, unit cost, total cost, customer selling price and budget variance
- Actual quantity/unit-cost capture
- Approved expenses can be linked to a Detailed Budget Item and automatically feed its actual cost
- Estimated revenue/cost/profit/margin and actual revenue/cost/profit/margin
- Customer pricing can be grouped at Sub Item level or priced at Detailed Item level without double-counting
- Team Members can select budget detail targets when recording an expense, but cannot view internal costs/profit/margins

## Production deployment

### 1. Create Apps Script project

Create a standalone Apps Script project. Add all `.gs` files from `/apps-script` and use the included `appsscript.json` manifest.

### 2. Initialize database

Run `setupDreamEvents()` once from the Apps Script editor and authorize Sheets/Drive access. The return value contains:

- Database spreadsheet URL
- Root Drive folder URL
- Initial username: `finance`
- Generated temporary password

Record the temporary password and change it immediately after first controlled deployment.

### 3. Configure allowed frontend origin

In Apps Script **Project Settings → Script properties**, create:

`DREAM_EVENTS_FRONTEND_ORIGIN = https://YOUR-GITHUB-USERNAME.github.io`

If deployed under a custom domain, use the exact origin, e.g. `https://finance.dreamevents.lk`.

### 4. Deploy Apps Script

Deploy as **Web app**:

- Execute as: Me (the database owner)
- Who has access: Anyone (the application itself performs username/password authorization)

Copy the production `/exec` URL.

### 5. Connect the frontend

Edit `/assets/js/config.js`:

```js
API_URL: 'YOUR_APPS_SCRIPT_EXEC_URL',
DEMO_MODE: false,
```

### 6. Publish GitHub Pages

Create a repository, upload/push this project, then enable GitHub Pages from the default branch root.

## Important security notes

- Never put Google credentials, tokens or passwords in the GitHub repository.
- The production app authorizes every protected API action on the server side.
- Finance Head-only data is removed/blocked server-side, not just hidden with CSS.
- Approved financial records should be reversed/reopened through controlled workflows instead of being deleted.
- Custom username/password auth is the requested V1 approach. A future hardening phase should consider Google Identity or another managed identity provider.

## Project structure

```
index.html
assets/
  css/styles.css
  js/config.js
  js/api.js
  js/app.js
apps-script/
  Code.gs
  Setup.gs
  Database.gs
  Utils.gs
  Auth.gs
  Customers.gs
  Events.gs
  Budget.gs
  Transactions.gs
  Dashboard.gs
  appsscript.json
docs/
  database-map.md
  deployment-checklist.md
```

## Next build modules

1. Package templates
2. Quotation versioning + branded PDF generation
3. Invoice/payment plan/receipt generation
4. File upload to Drive for bills and proofs
5. Refunds/reopen/reversal workflows
6. Inventory reservations and internal cost per use
7. Reimbursements/payables settlement
8. Reports and cash flow
