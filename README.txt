Dream Events Finance V1.8.2 — My Account / Change Password

Adds a Change Password button in the sidebar for EVERY signed-in user.

Team Members:
- Can change their own password.
- Still cannot access Administration.
- Cannot manage other users.
- Cannot see Finance Head-only reports/settings.

Finance Heads:
- Can also use the same sidebar Change Password button.
- Administration password controls remain available.

Password form:
- Current password
- New password
- Confirm new password
- Minimum 10 characters
- Enter does not prematurely submit
- Backdrop click does not close the password form
- Save button is disabled while the password request is running

INSTALL — GITHUB ONLY
1. Replace index.html.
2. Add assets/js/my-account.js.
3. Commit, e.g.:
   V1.8.2 add My Account password change
4. Wait for GitHub Pages.
5. Press Ctrl + Shift + R.

NO GOOGLE APPS SCRIPT CHANGE.
NO REDEPLOYMENT REQUIRED.
DO NOT run setupDreamEvents().

The backend changeMyPassword action already exists in V1.8.
