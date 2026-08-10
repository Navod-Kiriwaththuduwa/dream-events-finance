# Dream Events Finance – Budget Form Hotfix

This update fixes the issue where the **Sub Item** or **Detailed Item** form could submit and close before the user finished entering all fields.

## Fixes

- Budget items save only when **Add Item** / **Save Changes** is clicked.
- Pressing **Enter** inside budget text/number fields no longer submits the form.
- Prevents double-click duplicate submissions while the server request is running.
- If saving fails, the form stays open with the entered values.
- Clicking the dark modal backdrop no longer closes an open budget-item form accidentally. Use **Cancel** or **X** to close it.

## Upload

Upload the `assets` folder to the existing GitHub repository root and replace the existing file:

`assets/js/app.js`

Commit message suggestion:

`Fix premature budget item form closing`

This is frontend-only. **No Apps Script redeployment is required.**
