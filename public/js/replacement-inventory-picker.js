(function () {
  function getPickerRoots(scope) {
    if (scope && scope.querySelector) {
      const inScope = scope.querySelector('[data-picker-root]');
      return inScope ? [inScope] : [];
    }
    return Array.from(document.querySelectorAll('[data-picker-root]'));
  }

  function getCategoryMismatchMessage(root) {
    const selected = root.querySelectorAll('.replacement-checkbox:checked');
    if (selected.length < 2) return null;

    const keys = new Set();
    const names = new Set();

    selected.forEach((cb) => {
      const row = cb.closest('.replacement-picker-item');
      if (!row) return;
      const key = row.getAttribute('data-category-key');
      const name = row.getAttribute('data-category-name') || 'Tanpa kategori';
      if (key) keys.add(key);
      names.add(name);
    });

    if (keys.size <= 1) return null;

    return `Kategori inventaris yang dipilih berbeda (${[...names].join(', ')}). Pastikan item pengadaan ini memang menggantikan semua barang tersebut.`;
  }

  function initReplacementInventoryPicker(root, reasonEl) {
    if (!root || root.dataset.pickerReady === '1') return;
    root.dataset.pickerReady = '1';

    const searchInput = root.querySelector('.replacement-search');
    const checkboxes = root.querySelectorAll('.replacement-checkbox');
    const countEl = root.querySelector('.replacement-selected-count');
    const clearBtn = root.querySelector('.replacement-clear-all');
    const categoryWarning = root.querySelector('.replacement-category-warning');
    const categoryWarningText = root.querySelector('.replacement-category-warning-text');
    const items = root.querySelectorAll('.replacement-picker-item');
    const parentForm = root.closest('form');

    function updateState() {
      const selected = root.querySelectorAll('.replacement-checkbox:checked');
      const count = selected.length;
      if (countEl) countEl.textContent = String(count);
      if (clearBtn) clearBtn.hidden = count === 0;
      if (reasonEl) reasonEl.required = count > 0;

      const mismatchMsg = getCategoryMismatchMessage(root);
      if (categoryWarning && categoryWarningText) {
        if (mismatchMsg) {
          categoryWarningText.textContent = mismatchMsg;
          categoryWarning.classList.remove('d-none');
        } else {
          categoryWarningText.textContent = '';
          categoryWarning.classList.add('d-none');
        }
      }
    }

    checkboxes.forEach((cb) => cb.addEventListener('change', updateState));

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        checkboxes.forEach((cb) => {
          cb.checked = false;
        });
        updateState();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        items.forEach((item) => {
          const text = item.getAttribute('data-search-text') || '';
          item.style.display = !query || text.includes(query) ? '' : 'none';
        });
      });
    }

    if (parentForm && !parentForm.dataset.categoryWarnBound && !parentForm.dataset.ajaxItemForm) {
      parentForm.dataset.categoryWarnBound = '1';
      parentForm.addEventListener('submit', async function (e) {
        if (parentForm.dataset.replacementConfirmSubmitting === '1') return;

        const msg = getCategoryMismatchMessage(root);
        if (!msg) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const confirmed = window.uiConfirm
          ? await window.uiConfirm(`${msg}\n\nLanjutkan menyimpan?`, { title: 'Periksa Kategori Pengganti', confirmText: 'Tetap Simpan' })
          : true;

        if (!confirmed) return;

        parentForm.dataset.replacementConfirmSubmitting = '1';
        HTMLFormElement.prototype.submit.call(parentForm);
      });
    }

    root._replacementPickerUpdate = updateState;
    root._replacementPickerSetEnabled = function (enabled) {
      checkboxes.forEach((cb) => {
        cb.disabled = !enabled;
        if (!enabled) cb.checked = false;
      });
      if (searchInput) searchInput.disabled = !enabled;
      if (clearBtn) clearBtn.disabled = !enabled;
      updateState();
    };

    updateState();
  }

  window.initReplacementInventoryPickers = function (scope, reasonEl) {
    getPickerRoots(scope).forEach((root) => initReplacementInventoryPicker(root, reasonEl));
  };

  window.getReplacementCategoryMismatch = function (scope) {
    const root = scope && scope.querySelector ? scope.querySelector('[data-picker-root]') : scope;
    if (!root) return null;
    return getCategoryMismatchMessage(root);
  };

  window.setReplacementPickerEnabled = function (enabled, scope) {
    getPickerRoots(scope).forEach((root) => {
      if (root._replacementPickerSetEnabled) {
        root._replacementPickerSetEnabled(enabled);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    const reasonEl = document.getElementById('replacement_reason');
    window.initReplacementInventoryPickers(null, reasonEl);
  });
})();
