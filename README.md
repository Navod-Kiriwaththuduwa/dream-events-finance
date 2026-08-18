# Thambili Events Rebrand — V1.9.0

This update changes the visible brand from **Dream Events** to **Thambili Events** and applies the supplied logo palette.

## Brand palette
- Primary orange: `#FF4400` — sampled from the supplied logo
- Deep orange: `#D63800`
- Soft orange: `#FFF1EB`
- Warm background: `#F7F6F3`
- White: `#FFFFFF`
- Charcoal: `#1B1816`

Functional green/red status colors remain because they communicate approval/error states.

## Changes
- Browser title: Thambili Events Finance
- Login branding: Thambili Events
- Sidebar branding: Thambili Events
- Supplied logo used in login + sidebar
- Page eyebrow: THAMBILI EVENTS
- Main buttons use Thambili orange
- Active navigation uses Thambili orange
- Hero/dashboard branding updated
- Forms/focus states use orange
- Quotation / Invoice / Receipt previews are rebranded
- Printed quotation / invoice / receipt output is rebranded
- "Dream Events Cash/Bank" display labels become "Thambili Events Cash/Bank"
- Google Drive helper wording is rebranded
- Administration company name is migrated to Thambili Events
- Existing database and Drive folder names can be safely renamed

## IMPORTANT — intentionally NOT changed
For production compatibility, these stay unchanged:
- Existing `DE-EVT`, `DE-QTN`, `DE-INV`, etc. record IDs
- `DREAM_EVENTS_CONFIG` JavaScript variable name
- `DREAM_EVENTS_*` Script Properties
- session key
- Apps Script deployment URL
- GitHub repository / GitHub Pages URL

Changing these is a separate migration and is not needed for the visible company rebrand.

# Installation

## A. GitHub
Replace:
- `index.html`
- `assets/js/config.js`

Add:
- `assets/js/branding.js`
- `assets/css/thambili-theme.css`
- `assets/img/thambili-logo.png`

Keep all existing files, including:
- `assets/css/mobile-responsive.css`
- `assets/js/api-hotfix.js`
- `assets/js/admin-form-hotfix.js`
- `assets/js/my-account.js`

Commit example:
`V1.9 rebrand to Thambili Events`

Wait for GitHub Pages, then hard refresh.

## B. Google Apps Script — one-time brand migration
Create a new file:
- `Branding.gs`

Paste the supplied `apps-script/Branding.gs`.

Save, then from the function dropdown select:
`applyThambiliBranding`

Click **Run** once.

This updates only the company display name and renames the existing DB/Drive container by ID.
It does NOT reset the database or counters.

**Do NOT run `setupDreamEvents()`.**

No Web App redeployment is required for this Branding.gs migration.

## Result
The user-facing system and customer documents will show **Thambili Events** with the orange/white/charcoal brand palette.
