(() => {
  const API = window.DE_API;
  if (!API) return;

  const $ = (s, root=document) => root.querySelector(s);
  const escapeHtml = s => String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  function toast(message, type='ok') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${type}`;
    setTimeout(() => el.className = 'toast', 2800);
  }

  function closeModal() {
    $('#modal')?.classList.add('hidden');
  }

  function openPasswordModal() {
    const session = API.getSession();
    if (!session?.user) {
      toast('Please sign in first.', 'error');
      return;
    }

    $('#modalTitle').textContent = 'Change Password';
    $('#modalBody').innerHTML = `
      <form id="myAccountPasswordForm" class="form-grid" novalidate>
        <div class="span-2">
          <p style="margin:0 0 4px"><b>${escapeHtml(session.user.fullName || session.user.username || 'User')}</b></p>
          <small>Signed in as ${escapeHtml(session.user.username || '')}</small>
        </div>

        <label class="span-2">Current password
          <input type="password" name="currentPassword" required autocomplete="current-password">
        </label>

        <label class="span-2">New password
          <input type="password" name="newPassword" minlength="10" required autocomplete="new-password">
          <small>Minimum 10 characters.</small>
        </label>

        <label class="span-2">Confirm new password
          <input type="password" name="confirmPassword" minlength="10" required autocomplete="new-password">
        </label>

        <div class="form-actions span-2">
          <button type="button" id="myAccountCancelBtn" class="btn btn-ghost">Cancel</button>
          <button type="button" id="myAccountSaveBtn" class="btn btn-primary">Change Password</button>
        </div>
      </form>`;

    $('#modal').classList.remove('hidden');

    const form = $('#myAccountPasswordForm');
    const saveBtn = $('#myAccountSaveBtn');

    // Do not allow Enter to accidentally submit a partially completed password form.
    form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopPropagation();
    });

    $('#myAccountCancelBtn').onclick = closeModal;

    saveBtn.onclick = async () => {
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const currentPassword = String(fd.get('currentPassword') || '');
      const newPassword = String(fd.get('newPassword') || '');
      const confirmPassword = String(fd.get('confirmPassword') || '');

      if (newPassword !== confirmPassword) {
        toast('New passwords do not match.', 'error');
        return;
      }

      if (newPassword.length < 10) {
        toast('New password must be at least 10 characters.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Changing…';

      try {
        await API.request('changeMyPassword', { currentPassword, newPassword });
        closeModal();
        toast('Password changed successfully.');
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Change Password';
        toast(err.message, 'error');
      }
    };
  }

  function installSidebarButton() {
    const footer = document.querySelector('.sidebar-footer');
    const logout = $('#logoutBtn');
    if (!footer || !logout || $('#myAccountPasswordBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'myAccountPasswordBtn';
    btn.type = 'button';
    btn.className = 'btn btn-ghost full';
    btn.textContent = 'Change Password';
    btn.style.marginBottom = '6px';
    btn.onclick = openPasswordModal;

    footer.insertBefore(btn, logout);
  }

  // Stop the shared backdrop-close handler while the My Account password form is open.
  const modal = $('#modal');
  if (modal) {
    modal.addEventListener('click', event => {
      if (event.target === modal && $('#myAccountPasswordForm')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  installSidebarButton();
})();