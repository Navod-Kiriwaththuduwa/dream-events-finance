(() => {
  const ADMIN_FORM_IDS = new Set([
    'createAdminUserForm',
    'editAdminUserForm',
    'changeMyPasswordForm',
    'adminSettingsForm'
  ]);

  function currentAdminForm() {
    const form = document.querySelector('#modalBody form, #adminBody form');
    return form && ADMIN_FORM_IDS.has(form.id) ? form : null;
  }

  // Protect Administration modal forms from accidental backdrop closure.
  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', event => {
      if (event.target === modal && currentAdminForm()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  // Administration forms should only save from their visible Save/Create/Change button.
  // Enter inside an input/select must not submit the half-completed form.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;

    const form = event.target?.closest?.('form');
    if (!form || !ADMIN_FORM_IDS.has(form.id)) return;

    // Keep normal multi-line behavior in textareas.
    if (event.target.tagName === 'TEXTAREA') return;

    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // Prevent accidental double submits while a save request is in progress.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form || !ADMIN_FORM_IDS.has(form.id)) return;

    const submitter = event.submitter;
    if (submitter && submitter.dataset.adminSubmitting === '1') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (submitter) {
      submitter.dataset.adminSubmitting = '1';
      const oldText = submitter.textContent;
      submitter.dataset.adminOldText = oldText;
      submitter.disabled = true;
      if (/save/i.test(oldText)) submitter.textContent = 'Saving…';
      else if (/change/i.test(oldText)) submitter.textContent = 'Changing…';
      else if (/create/i.test(oldText)) submitter.textContent = 'Creating…';

      // admin.js handles success/error. Re-enable after a safe window if the form remains open.
      setTimeout(() => {
        if (document.body.contains(submitter)) {
          submitter.disabled = false;
          submitter.textContent = submitter.dataset.adminOldText || oldText;
          submitter.dataset.adminSubmitting = '0';
        }
      }, 35000);
    }
  }, true);
})();