// GreenNest – admin panel interactions
(function () {
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Sidebar (mobile)
  const toggleSidebar = (open) => document.body.classList.toggle('sidebar-open', open);
  $$('[data-sidebar-open]').forEach((b) => b.addEventListener('click', () => toggleSidebar(true)));
  $$('[data-sidebar-close]').forEach((b) => b.addEventListener('click', () => toggleSidebar(false)));

  // Confirm destructive actions
  $$('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });

  // Image preview before upload
  $$('[data-preview-input]').forEach((input) => {
    const img = input.closest('.upload').querySelector('[data-preview]');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) img.src = URL.createObjectURL(file);
    });
  });

  // Auto-submit search on Enter is native; submit status chips forms on change
  $$('.alert--success').forEach((a) => setTimeout(() => { a.style.transition = 'opacity .4s'; a.style.opacity = '0'; setTimeout(() => a.remove(), 400); }, 5000));
})();
