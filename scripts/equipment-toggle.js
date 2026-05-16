/* 3D/2D Toggle — Equipment slide segment switcher
 * Pattern: any slide with .equipment-toggle root gets a pill switch
 * and content panes activate by data-pane attribute */
(function () {
  function bindToggle(root) {
    if (root.__bound) return;
    root.__bound = true;

    const buttons = root.querySelectorAll('.toggle-btn');
    const panes = root.querySelectorAll('.toggle-pane');

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.pane;
        if (!target) return;

        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        panes.forEach((p) => {
          const isTarget = p.dataset.pane === target;
          p.classList.toggle('active', isTarget);
          // 3D pane aktif olduğunda canvas resize dispatch et
          if (isTarget && p.dataset.pane === '3d') {
            window.dispatchEvent(new CustomEvent('toggle-3d-active', {
              detail: { slide: root.closest('.slide') }
            }));
          }
        });
      });
    });
  }

  function init() {
    document.querySelectorAll('.equipment-toggle').forEach(bindToggle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
