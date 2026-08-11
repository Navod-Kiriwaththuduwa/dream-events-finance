# Dream Events Finance V1.8.0 — Administration

This update adds the Administration module without changing the database structure.

## New features

### Business Settings
- Company name
- Phone, email, address and registration number
- Bank name, branch, account name and account number
- Quotation validity days
- Default invoice due days (stored centrally for invoice-default integration)
- Default quotation terms
- Currency remains locked to LKR
- Timezone remains locked to Asia/Colombo

The quotation validity and default quotation terms are used by new quotation drafts after this update.

### Users & Access
- List users
- Create Finance Head or Team Member accounts
- Secure temporary password generated on user creation
- Edit full name, role and status
- Activate / deactivate users
- Reset another user's password
- Change your own password
- Invalidate sessions when a user is deactivated or their password is reset
- Prevent removing access from the currently logged-in Finance Head
- Prevent leaving the system with no active Finance Head

### System
- Total / active user counts
- Active session count
- Current year document counters (read-only)
- Recent audit activity

## GitHub files

Upload / replace:
- `index.html` — replace
- `assets/css/admin.css` — new
- `assets/js/admin.js` — new
- `apps-script/Code.gs` — replace GitHub copy
- `apps-script/Admin.gs` — new
- `apps-script/Quotations.gs` — replace GitHub copy

Keep all existing V1.7.1 files, including the corrected `Budget.gs`.

## Google Apps Script

1. Replace `Code.gs`.
2. Create a new file named `Admin.gs` and paste the supplied file.
3. Replace `Quotations.gs`.
4. Save.
5. Deploy → Manage deployments → Edit → New version.
6. Description: `V1.8 administration`
7. Keep Execute as: Me.
8. Keep Who has access: Anyone.
9. Deploy.

Do NOT run `setupDreamEvents()`.

## Recommended test

1. Open Administration → Business Settings and save company phone / quotation terms.
2. Start a new quotation draft and verify the saved default terms appear.
3. Create one Team Member test account and copy its temporary password.
4. Sign in with the Team Member account in an Incognito window.
5. Verify restricted Finance Head menus are hidden.
6. Return to Finance Head → Administration → deactivate the test user.
7. Verify the Team Member cannot continue using the system after their session is checked again.
8. Re-enable the user if needed.

No existing events, budgets, quotations, payments, expenses, suppliers, inventory or reports are deleted.
