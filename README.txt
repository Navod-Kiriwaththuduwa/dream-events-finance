Dream Events Finance V1.8.1 — Administration Form Hotfix

Fixes Administration forms closing or submitting before the user intentionally saves.

Fixes:
- Edit User stays open while filling the form.
- Change My Password stays open while filling the form.
- Create User gets the same protection.
- Enter in an input/select no longer prematurely submits Administration forms.
- Accidental clicks on the dark modal backdrop no longer close an Administration form.
- Submit buttons are protected from accidental double-submit while the request is running.

INSTALL — GITHUB ONLY
1. Replace index.html.
2. Add assets/js/admin-form-hotfix.js.
3. Commit, for example:
   V1.8.1 administration form hotfix
4. Wait for GitHub Pages.
5. Press Ctrl + Shift + R.

NO GOOGLE APPS SCRIPT CHANGE.
NO DEPLOYMENT REQUIRED.
DO NOT run setupDreamEvents().
