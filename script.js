const App = (function() {
  'use strict';

  const TYPES = ['garena', 'gmail', 'facebook'];
  const PAGE_SIZE = 7; // Mỗi trang hiển thị đúng 7 tài khoản

  const CONFIG = {
    garena: {
      storageKey: 'garena_accounts',
      mainField: 'tenGarena',
      label: 'Garena',
      fields: [
        { key: 'tenNhanVat', label: 'Tên trong game', required: false },
        { key: 'tenGarena', label: 'Tên tài khoản Garena', required: true }
      ],
      importColumns: ['tenNhanVat', 'tenGarena'],
      importHint: 'Tên trong game | Tên tài khoản Garena'
    },
    gmail: {
      storageKey: 'gmail_accounts',
      mainField: 'gmail',
      label: 'Gmail',
      fields: [
        { key: 'tenNhanVat', label: 'Tên trong game', required: false },
        { key: 'gmail', label: 'Tên tài khoản Gmail', required: true }
      ],
      importColumns: ['tenNhanVat', 'gmail'],
      importHint: 'Tên trong game | Tên tài khoản Gmail'
    },
    facebook: {
      storageKey: 'facebook_accounts',
      mainField: 'facebook',
      label: 'Facebook',
      fields: [
        { key: 'tenNhanVat', label: 'Tên trong game', required: false },
        { key: 'facebook', label: 'Tên tài khoản Facebook', required: true }
      ],
      importColumns: ['tenNhanVat', 'facebook'],
      importHint: 'Tên trong game | Tên tài khoản Facebook'
    }
  };

  const SUN_ICON = `<svg viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

  const MOON_ICON = `<svg viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

  // === STATE ===
  const state = {
    garena: [], gmail: [], facebook: [],
    searchTerm: '',
    page: { garena: 1, gmail: 1, facebook: 1 },
    draggedId: null,
    draggedType: null,
    pageHoverTimer: null,
    snapshotType: null,
    confirmResolver: null,
    importType: null, importData: null,
    exportType: null, addType: null,
    editType: null, editId: null
  };

  // === TIỆN ÍCH ===
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function removeDiacritics(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D');
  }
  function matchSearch(text, term) {
    if (!term) return true;
    return removeDiacritics((text || '').toLowerCase()).includes(removeDiacritics(term.toLowerCase()));
  }
  function highlightText(text, term) {
    if (!term || !text) return escapeHtml(text || '');
    const tN = removeDiacritics(text.toLowerCase()), qN = removeDiacritics(term.toLowerCase());
    let r = '', last = 0, i = tN.indexOf(qN);
    while (i !== -1) {
      r += escapeHtml(text.substring(last, i));
      r += '<mark>' + escapeHtml(text.substring(i, i + term.length)) + '</mark>';
      last = i + term.length; i = tN.indexOf(qN, last);
    }
    return r + escapeHtml(text.substring(last));
  }
  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => el.classList.add('fade-out'), 2200);
    setTimeout(() => el.remove(), 2600);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function cleanKey(s) {
    if (!s) return '';
    return s.toLowerCase().replace(/@gmail\.com$/i, '').replace(/@.*$/i, '').replace(/@/g, '').trim();
  }

  // === POPUP XÁC NHẬN ĐẸP (SWEETALERT2 STYLE) ===
  function showConfirm({ type = 'warning', title = 'Xác nhận', message = '', okText = 'Xác nhận', cancelText = 'Huỷ', okBtnClass = 'btn-primary' }) {
    return new Promise(resolve => {
      const iconCircle = document.getElementById('confirmIconCircle');
      const titleEl = document.getElementById('confirmTitle');
      const msgEl = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('confirmOkBtn');
      const cancelBtn = document.getElementById('confirmCancelBtn');

      titleEl.textContent = title;
      msgEl.innerHTML = message;
      okBtn.textContent = okText;
      okBtn.className = `btn ${okBtnClass}`;

      if (cancelText) {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = cancelText;
      } else {
        cancelBtn.style.display = 'none';
      }

      iconCircle.className = `confirm-icon-circle icon-${type}`;
      if (type === 'success') {
        iconCircle.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else if (type === 'danger') {
        iconCircle.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
      } else {
        iconCircle.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
      }

      let isFinished = false;
      function finish(val) {
        if (isFinished) return;
        isFinished = true;
        state.confirmResolver = null;
        closeModalDirect('confirmModal');
        resolve(val);
      }

      state.confirmResolver = finish;
      openModal('confirmModal');

      okBtn.onclick = (e) => {
        e.stopPropagation();
        finish(true);
      };
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        finish(false);
      };
    });
  }

  // === TỰ ĐỘNG ĐỒNG BỘ TÊN NHÂN VẬT GARENA TỪ BẢNG GMAIL ===
  function autoSyncGarenaFromGmail() {
    const emailToGameName = new Map();
    state.gmail.forEach(g => {
      const email = cleanKey(g.gmail);
      const gameName = (g.tenNhanVat || '').trim();
      if (email && gameName) {
        emailToGameName.set(email, gameName);
      }
    });

    let hasChange = false;
    state.garena.forEach(gar => {
      const currentName = (gar.tenNhanVat || '').trim();
      const currentEmail = cleanKey(gar.gmailDangKy || (currentName.includes('@') ? currentName : ''));

      if (currentEmail && emailToGameName.has(currentEmail)) {
        const matchedName = emailToGameName.get(currentEmail);
        if (gar.tenNhanVat !== matchedName) {
          gar.tenNhanVat = matchedName;
          hasChange = true;
        }
      } else if (gar.tenNhanVat && gar.tenNhanVat === gar.tenGarena) {
        gar.tenNhanVat = '';
        hasChange = true;
      }
    });

    if (hasChange) {
      saveData('garena');
    }
  }

  // === LOCALSTORAGE ===
  function loadData() {
    TYPES.forEach(t => {
      try { const r = localStorage.getItem(CONFIG[t].storageKey); state[t] = r ? JSON.parse(r) : []; }
      catch { state[t] = []; }
    });

    // Tự động đối soát và điền tên nhân vật game cho bảng Garena
    autoSyncGarenaFromGmail();

    const currentTheme = localStorage.getItem('app_theme') || 'light';
    setTheme(currentTheme);
  }
  function saveData(type) {
    localStorage.setItem(CONFIG[type].storageKey, JSON.stringify(state[type]));
  }

  // === CRUD ===
  function addAccount(type, data) {
    state[type].unshift({ id: uuid(), daDangNhap: false, ...data });
    saveData(type);
    state.page[type] = 1;
    if (type === 'gmail') autoSyncGarenaFromGmail();
    render(type);
    toast('Đã thêm tài khoản');
  }
  function addAccountSilent(type, data) {
    state[type].push({ id: uuid(), daDangNhap: false, ...data });
  }
  function updateAccount(type, id, updates) {
    const acc = state[type].find(a => a.id === id);
    if (acc) {
      Object.assign(acc, updates);
      saveData(type);
      if (type === 'gmail') autoSyncGarenaFromGmail();
      render(type);
    }
  }

  async function deleteAccount(type, id) {
    const acc = state[type].find(a => a.id === id);
    const name = acc ? (acc[CONFIG[type].mainField] || 'tài khoản này') : 'tài khoản này';

    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Xoá tài khoản?',
      message: `Bạn có chắc chắn muốn xoá tài khoản <b>"${escapeHtml(name)}"</b> không?`,
      okText: 'Xoá tài khoản',
      cancelText: 'Huỷ',
      okBtnClass: 'btn-danger'
    });

    if (!confirmed) return;

    state[type] = state[type].filter(a => a.id !== id);
    saveData(type); render(type);
    toast('Đã xoá tài khoản');
  }

  function toggleCheck(type, id) {
    const acc = state[type].find(a => a.id === id);
    if (acc) { acc.daDangNhap = !acc.daDangNhap; saveData(type); render(type); }
  }

  // === SẮP XẾP TỰ ĐỘNG (CHƯA TICK LÊN TRÊN, TICK RỒI XUỐNG DƯỚI) ===
  function getSorted(type) {
    const list = [...state[type]];
    list.sort((a, b) => {
      if (a.daDangNhap !== b.daDangNhap) return a.daDangNhap ? 1 : -1;
      return 0;
    });
    return list;
  }

  // === PHÂN TRANG ===
  function changePage(type, targetPage) {
    state.page[type] = targetPage;
    renderList(type);
  }

  // === RENDER ===
  function render(type) {
    renderList(type);
    renderCounters(type);
  }

  function renderCounters(type) {
    const list = state[type];
    const total = list.length, done = list.filter(a => a.daDangNhap).length;
    document.getElementById('counters' + cap(type)).innerHTML =
      `<span class="counter-badge counter-total">Tổng: <b>${total}</b></span>` +
      `<span class="counter-badge counter-remaining">Còn lại: <b>${total - done}</b></span>` +
      `<span class="counter-badge counter-done">Đã xong: <b>${done}</b></span>`;
  }

  function renderList(type) {
    const listEl = document.getElementById('list' + cap(type));
    const pagEl = document.getElementById('pagination' + cap(type));
    let sorted = getSorted(type);
    const term = state.searchTerm;
    if (term) {
      sorted = sorted.filter(acc => matchSearch(acc[CONFIG[type].mainField] || '', term) || matchSearch(acc.tenNhanVat || '', term));
    }

    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

    if (state.page[type] > totalPages) state.page[type] = totalPages;
    if (state.page[type] < 1) state.page[type] = 1;

    const currentPage = state.page[type];

    if (totalItems === 0) {
      listEl.innerHTML = `<div class="empty-state">
        <p>${term ? 'Không tìm thấy tài khoản phù hợp.' : 'Chưa có tài khoản nào.<br>Nhấn nút <b>+</b> để bắt đầu.'}</p>
      </div>`;
      pagEl.style.display = 'none';
      pagEl.innerHTML = '';
      return;
    }

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = sorted.slice(startIndex, startIndex + PAGE_SIZE);

    listEl.innerHTML = pageItems.map(acc => renderRow(type, acc)).join('');

    // Render thanh phân trang - CHỈ NÚT BẤM SỐ TRANG
    if (totalPages > 1) {
      pagEl.style.display = 'flex';
      let pagesHtml = '';

      if (totalPages <= 6) {
        for (let i = 1; i <= totalPages; i++) {
          const activeCls = i === currentPage ? 'active' : '';
          pagesHtml += `<button class="page-num-btn ${activeCls}" data-page="${i}" onclick="App.changePage('${type}', ${i})">${i}</button>`;
        }
      } else {
        pagesHtml += `<button class="page-num-btn ${currentPage === 1 ? 'active' : ''}" data-page="1" onclick="App.changePage('${type}', 1)">1</button>`;
        if (currentPage > 3) pagesHtml += `<span class="page-dots">…</span>`;

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) {
          pagesHtml += `<button class="page-num-btn ${i === currentPage ? 'active' : ''}" data-page="${i}" onclick="App.changePage('${type}', ${i})">${i}</button>`;
        }

        if (currentPage < totalPages - 2) pagesHtml += `<span class="page-dots">…</span>`;
        pagesHtml += `<button class="page-num-btn ${currentPage === totalPages ? 'active' : ''}" data-page="${totalPages}" onclick="App.changePage('${type}', ${totalPages})">${totalPages}</button>`;
      }

      pagEl.innerHTML = `
        <button class="page-btn page-arrow" onclick="App.changePage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="Trang trước">‹</button>
        <div class="page-numbers-wrap">${pagesHtml}</div>
        <button class="page-btn page-arrow" onclick="App.changePage('${type}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} title="Trang sau">›</button>
      `;
    } else {
      pagEl.style.display = 'none';
      pagEl.innerHTML = '';
    }

    setupDragAndDrop(type);
  }

  // Dòng tài khoản dạng cột: [⠿ Kéo thả] [Checkbox] [Cột 1: Tên trong game | Cột 2: Tên tài khoản] [✏️ 🗑️]
  function renderRow(type, acc) {
    const cfg = CONFIG[type];
    const term = state.searchTerm;
    const mainText = highlightText(acc[cfg.mainField] || '', term);
    const gameName = acc.tenNhanVat ? highlightText(acc.tenNhanVat, term) : '<span style="color:var(--text-muted)">—</span>';
    const checkedCls = acc.daDangNhap ? 'checked' : '';

    return `
    <div class="account-row ${checkedCls}" draggable="true" data-id="${acc.id}" data-type="${type}">
      <div class="drag-handle" title="Kéo thả dòng hoặc kéo vào số trang để đổi trang">⠿</div>
      <div class="custom-checkbox ${acc.daDangNhap ? 'is-checked' : ''}" onclick="App.toggleCheck('${type}','${acc.id}')" title="Đánh dấu đã đăng nhập">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="account-cols">
        <span class="col-game" title="Tên trong game">${gameName}</span>
        <span class="col-divider">|</span>
        <span class="col-acc" title="Tên tài khoản">${mainText}</span>
      </div>
      <div class="row-actions">
        <button class="row-action-btn edit-btn" onclick="App.openEditModal('${type}','${acc.id}')" title="Sửa thông tin">✏️</button>
        <button class="row-action-btn delete-btn" onclick="App.deleteAccount('${type}','${acc.id}')" title="Xoá">🗑</button>
      </div>
    </div>`;
  }

  // === KÉO THẢ SẮP XẾP THỨ TỰ & KÉO SANG TRANG KHÁC ===
  function setupDragAndDrop(type) {
    const panelEl = document.getElementById('panel' + cap(type));
    if (!panelEl) return;
    const rows = panelEl.querySelectorAll('.account-row');
    const pageButtons = panelEl.querySelectorAll('.page-num-btn');

    // 1. Kéo thả giữa các dòng trong trang hiện tại
    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        state.draggedId = row.dataset.id;
        state.draggedType = row.dataset.type;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.id);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        rows.forEach(r => r.classList.remove('drag-over'));
        pageButtons.forEach(btn => btn.classList.remove('drag-target-hover'));
        clearTimeout(state.pageHoverTimer);
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        rows.forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const targetId = row.dataset.id;
        const targetType = row.dataset.type;
        const sourceId = state.draggedId;
        const sourceType = state.draggedType;

        if (!sourceId || !targetId || sourceId === targetId || sourceType !== targetType) return;

        const arr = state[sourceType];
        const fromIndex = arr.findIndex(a => a.id === sourceId);
        const toIndex = arr.findIndex(a => a.id === targetId);

        if (fromIndex !== -1 && toIndex !== -1) {
          const [movedItem] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, movedItem);
          saveData(sourceType);
          renderList(sourceType);
          toast('Đã cập nhật vị trí tài khoản');
        }
      });
    });

    // 2. KÉO THẢ TRỰC TIẾP VÀO NÚT SỐ TRANG ĐỂ CHUYỂN TRANG
    pageButtons.forEach(btn => {
      const targetPage = parseInt(btn.dataset.page, 10);

      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        btn.classList.add('drag-target-hover');

        if (!state.pageHoverTimer && state.page[type] !== targetPage) {
          state.pageHoverTimer = setTimeout(() => {
            state.page[type] = targetPage;
            renderList(type);
            toast(`Đang ở Trang ${targetPage}`);
          }, 450);
        }
      });

      btn.addEventListener('dragleave', () => {
        btn.classList.remove('drag-target-hover');
        clearTimeout(state.pageHoverTimer);
        state.pageHoverTimer = null;
      });

      btn.addEventListener('drop', (e) => {
        e.preventDefault();
        btn.classList.remove('drag-target-hover');
        clearTimeout(state.pageHoverTimer);
        state.pageHoverTimer = null;

        const sourceId = state.draggedId;
        const sourceType = state.draggedType;
        if (!sourceId || sourceType !== type) return;

        const arr = state[type];
        const fromIndex = arr.findIndex(a => a.id === sourceId);
        if (fromIndex === -1) return;

        const targetIndex = (targetPage - 1) * PAGE_SIZE;
        const [movedItem] = arr.splice(fromIndex, 1);
        arr.splice(targetIndex, 0, movedItem);

        saveData(type);
        state.page[type] = targetPage;
        renderList(type);
        toast(`Đã chuyển tài khoản sang Trang ${targetPage}`);
      });
    });
  }

  // === 2 BẢN SAO LƯU VỊ TRÍ & TOÀN BỘ TÀI KHOẢN (SLOT 1 & SLOT 2) ===
  function openSnapshotModal(type) {
    state.snapshotType = type;
    const cfg = CONFIG[type];
    document.getElementById('snapshotModalTitle').textContent = 'Sao lưu vị trí tài khoản ' + cfg.label;

    [1, 2].forEach(slot => {
      const snapKey = `${type}_order_snapshot_${slot}`;
      const raw = localStorage.getItem(snapKey);
      const timeEl = document.getElementById(`slotTime${slot}`);
      const btnRestore = document.getElementById(`btnRestore${slot}`);
      const btnDelete = document.getElementById(`btnDeleteSnap${slot}`);

      if (raw) {
        try {
          const snap = JSON.parse(raw);
          const count = snap.count || (snap.accounts ? snap.accounts.length : (snap.order ? snap.order.length : 0));
          const cleanTime = (snap.time || '').replace(/\(.*\)/g, '').trim();
          const countText = count ? ` (${count} tài khoản)` : '';
          timeEl.textContent = cleanTime + countText;
          btnRestore.disabled = false;
          if (btnDelete) btnDelete.disabled = false;
        } catch {
          timeEl.textContent = 'Chưa có bản lưu';
          btnRestore.disabled = true;
          if (btnDelete) btnDelete.disabled = true;
        }
      } else {
        timeEl.textContent = 'Chưa có bản lưu';
        btnRestore.disabled = true;
        if (btnDelete) btnDelete.disabled = true;
      }
    });

    openModal('snapshotModal');
  }

  function saveOrderSnapshot(slot) {
    const type = state.snapshotType;
    if (!type) return;
    const cfg = CONFIG[type];
    const accountsCopy = JSON.parse(JSON.stringify(state[type]));
    const count = accountsCopy.length;
    const snap = {
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN'),
      count: count,
      accounts: accountsCopy,
      order: accountsCopy.map(a => a.id)
    };
    localStorage.setItem(`${type}_order_snapshot_${slot}`, JSON.stringify(snap));
    openSnapshotModal(type);
    toast(`Đã lưu Bản sao lưu ${slot} (${count} tài khoản)!`);
  }

  function restoreOrderSnapshot(slot) {
    const type = state.snapshotType;
    if (!type) return;
    const snapKey = `${type}_order_snapshot_${slot}`;
    const raw = localStorage.getItem(snapKey);
    if (!raw) {
      toast(`Chưa có dữ liệu Bản sao lưu ${slot}`);
      return;
    }

    try {
      const snap = JSON.parse(raw);
      if (snap.accounts && Array.isArray(snap.accounts)) {
        state[type] = JSON.parse(JSON.stringify(snap.accounts));
      } else if (snap.order && Array.isArray(snap.order)) {
        const idMap = new Map();
        state[type].forEach(a => idMap.set(a.id, a));
        const reordered = [];
        snap.order.forEach(id => {
          if (idMap.has(id)) reordered.push(idMap.get(id));
        });
        state[type] = reordered;
      }

      autoSyncGarenaFromGmail();
      saveData(type);
      state.page[type] = 1;
      render(type);
      closeModal('snapshotModal');
      toast(`Đã khôi phục về Bản sao lưu ${slot} (${state[type].length} tài khoản)!`);
    } catch {
      toast('Lỗi khi khôi phục dữ liệu bản lưu');
    }
  }

  async function deleteOrderSnapshot(slot) {
    const type = state.snapshotType;
    if (!type) return;
    const snapKey = `${type}_order_snapshot_${slot}`;
    const raw = localStorage.getItem(snapKey);
    if (!raw) {
      toast(`Bản sao lưu ${slot} đang trống`);
      return;
    }

    closeModal('snapshotModal');

    const confirmed = await showConfirm({
      type: 'danger',
      title: `Xoá Bản sao lưu ${slot}?`,
      message: `Bạn có chắc chắn muốn xoá dữ liệu của <b>Bản sao lưu ${slot}</b> không?`,
      okText: 'Xoá bản lưu',
      cancelText: 'Huỷ',
      okBtnClass: 'btn-danger'
    });

    if (confirmed) {
      localStorage.removeItem(snapKey);
      toast(`Đã xoá Bản sao lưu ${slot}!`);
    }

    openSnapshotModal(type);
  }

  // === RESET SỰ KIỆN CHUNG (CẢNH BÁO 2 LẦN, XONG TỰ ĐÓNG VÀ TOAST) ===
  async function resetAllEvents() {
    const step1 = await showConfirm({
      type: 'warning',
      title: 'Reset sự kiện?',
      message: 'Bạn có chắc chắn muốn đưa trạng thái của <b>TẤT CẢ</b> tài khoản về <b>chưa đăng nhập</b> không?',
      okText: 'Tiếp tục',
      cancelText: 'Huỷ',
      okBtnClass: 'btn-warning'
    });

    if (!step1) return;

    await new Promise(r => setTimeout(r, 120));

    const step2 = await showConfirm({
      type: 'warning',
      title: 'Xác nhận lần cuối!',
      message: 'Toàn bộ tài khoản sẽ được đánh dấu là chưa đăng nhập. Bạn đồng ý Reset chứ?',
      okText: 'Đồng ý Reset',
      cancelText: 'Huỷ',
      okBtnClass: 'btn-warning'
    });

    if (!step2) return;

    TYPES.forEach(t => {
      state[t].forEach(a => { a.daDangNhap = false; });
      saveData(t);
      render(t);
    });

    toast('Đã Reset sự kiện tất cả tài khoản');
  }

  // === XOÁ TẤT CẢ TÀI KHOẢN (CẢNH BÁO 2 LẦN, XONG TỰ ĐÓNG VÀ TOAST) ===
  async function deleteAllAccounts() {
    const total = TYPES.reduce((sum, t) => sum + state[t].length, 0);
    if (total === 0) {
      toast('Hiện không có tài khoản nào để xoá');
      return;
    }

    const step1 = await showConfirm({
      type: 'danger',
      title: 'Xoá toàn bộ tài khoản?',
      message: `CẢNH BÁO: Bạn có chắc chắn muốn xoá tất cả <b>${total} tài khoản</b> (Garena, Gmail, Facebook) không?`,
      okText: 'Tiếp tục xoá',
      cancelText: 'Huỷ',
      okBtnClass: 'btn-danger'
    });

    if (!step1) return;

    await new Promise(r => setTimeout(r, 120));

    const step2 = await showConfirm({
      type: 'danger',
      title: 'Xác nhận xoá vĩnh viễn!',
      message: 'Dữ liệu toàn bộ tài khoản sẽ bị <b>xoá vĩnh viễn</b> và không thể khôi phục. Bạn vẫn muốn xoá?',
      okText: 'Xoá vĩnh viễn',
      cancelText: 'Huỷ',
      okBtnClass: 'btn-danger'
    });

    if (!step2) return;

    TYPES.forEach(t => {
      state[t] = [];
      saveData(t);
      render(t);
    });

    toast('Đã xoá toàn bộ tài khoản');
  }

  // === MODAL: THÊM ===
  function openAddModal(type) {
    state.addType = type;
    document.getElementById('addModalTitle').textContent = 'Thêm tài khoản ' + CONFIG[type].label;
    document.getElementById('addFormFields').innerHTML = CONFIG[type].fields.map(f => `
      <div class="form-group">
        <label>${f.label}${f.required ? '<span class="required">*</span>' : ''}</label>
        <input type="text" id="addField_${f.key}" ${f.required ? 'required' : ''}>
      </div>
    `).join('');
    openModal('addModal');
    setTimeout(() => {
      const el = document.getElementById('addField_' + CONFIG[type].fields[0].key);
      if (el) el.focus();
    }, 250);
  }
  function submitAddForm(e) {
    if (e) e.preventDefault();
    const type = state.addType, cfg = CONFIG[type], data = {};
    for (const f of cfg.fields) {
      const el = document.getElementById('addField_' + f.key);
      const v = el ? el.value.trim() : '';
      if (f.required && !v) { toast(`Vui lòng nhập ${f.label}`); el.focus(); return false; }
      data[f.key] = v;
    }
    addAccount(type, data);
    closeModal('addModal');
    return false;
  }

  // === MODAL: SỬA & CHỌN TRANG ===
  function openEditModal(type, id) {
    const acc = state[type].find(a => a.id === id);
    if (!acc) return;
    state.editType = type;
    state.editId = id;
    const cfg = CONFIG[type];
    const totalPages = Math.ceil(state[type].length / PAGE_SIZE) || 1;
    const currentAccIndex = state[type].findIndex(a => a.id === id);
    const currentAccPage = Math.floor(currentAccIndex / PAGE_SIZE) + 1;

    let pageOptions = '';
    for (let p = 1; p <= totalPages; p++) {
      pageOptions += `<option value="${p}" ${p === currentAccPage ? 'selected' : ''}>Trang ${p}</option>`;
    }

    let fieldsHtml = cfg.fields.map(f => {
      const val = escapeHtml(acc[f.key] || '');
      return `
      <div class="form-group">
        <label>${f.label}${f.required ? '<span class="required">*</span>' : ''}</label>
        <input type="text" id="editField_${f.key}" value="${val}" ${f.required ? 'required' : ''}>
      </div>`;
    }).join('');

    if (totalPages > 1) {
      fieldsHtml += `
      <div class="form-group">
        <label>Chuyển đến Trang</label>
        <select id="editField_page" class="form-select">${pageOptions}</select>
      </div>`;
    }

    document.getElementById('editModalTitle').textContent = 'Sửa tài khoản ' + cfg.label;
    document.getElementById('editFormFields').innerHTML = fieldsHtml;
    openModal('editModal');
    setTimeout(() => {
      const el = document.getElementById('editField_' + cfg.fields[0].key);
      if (el) { el.focus(); el.select(); }
    }, 250);
  }

  function submitEditForm(e) {
    if (e) e.preventDefault();
    const type = state.editType, id = state.editId, cfg = CONFIG[type];
    const updates = {};
    for (const f of cfg.fields) {
      const el = document.getElementById('editField_' + f.key);
      const v = el ? el.value.trim() : '';
      if (f.required && !v) { toast(`Vui lòng nhập ${f.label}`); el.focus(); return false; }
      updates[f.key] = v;
    }

    const pageSelect = document.getElementById('editField_page');
    if (pageSelect) {
      const targetPage = parseInt(pageSelect.value, 10);
      const arr = state[type];
      const fromIndex = arr.findIndex(a => a.id === id);
      if (fromIndex !== -1) {
        const targetIndex = (targetPage - 1) * PAGE_SIZE;
        const [movedItem] = arr.splice(fromIndex, 1);
        arr.splice(targetIndex, 0, movedItem);
        state.page[type] = targetPage;
      }
    }

    updateAccount(type, id, updates);
    closeModal('editModal');
    toast('Đã cập nhật thông tin');
    return false;
  }

  // === MODAL: IMPORT ===
  function openImportModal(type) {
    state.importType = type; state.importData = null;
    document.getElementById('importModalTitle').textContent = 'Import tài khoản ' + CONFIG[type].label;
    document.getElementById('importColumnHint').textContent = CONFIG[type].importHint;
    document.getElementById('importTextarea').value = '';
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('importConfirmBtn').disabled = true;
    openModal('importModal');
    setTimeout(() => document.getElementById('importTextarea').focus(), 250);
  }

  function previewImport() {
    const type = state.importType, cfg = CONFIG[type];
    const raw = document.getElementById('importTextarea').value.trim();
    if (!raw) { toast('Vui lòng dán dữ liệu trước khi xem'); return; }

    const parsed = raw.split('\n').filter(l => l.trim()).map(line => {
      const cols = line.split('\t');
      const row = {};
      if (cols.length === 1) {
        row[cfg.mainField] = cols[0].trim();
        row.tenNhanVat = '';
      } else {
        // Cột 1: Tên trong game | Cột 2: Tên tài khoản
        row.tenNhanVat = (cols[0] || '').trim();
        row[cfg.mainField] = (cols[1] || '').trim();
      }
      return row;
    });

    const valid = parsed.filter(r => r[cfg.mainField]);
    if (!valid.length) { toast('Không tìm thấy dòng dữ liệu hợp lệ'); return; }
    state.importData = valid;

    const headers = cfg.fields.map(f => `<th>${f.label}</th>`).join('');
    const rows = valid.slice(0, 30).map(row =>
      '<tr>' + cfg.fields.map(f => `<td title="${escapeHtml(row[f.key]||'')}">${escapeHtml(row[f.key]||'—')}</td>`).join('') + '</tr>'
    ).join('');

    const more = valid.length > 30 ? `<span style="font-size:0.75rem;color:var(--text-muted)">(và ${valid.length - 30} dòng nữa)</span>` : '';

    document.getElementById('importPreview').innerHTML = `
      <div class="preview-container">
        <div class="preview-scroll">
          <table class="preview-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="preview-footer-bar">
          <span>Hợp lệ: <span class="preview-count">${valid.length}</span> tài khoản</span>
          ${more}
        </div>
      </div>
    `;
    document.getElementById('importConfirmBtn').disabled = false;
  }

  function confirmImport() {
    const type = state.importType, data = state.importData;
    if (!data || !data.length) return;
    data.forEach(row => addAccountSilent(type, row));
    saveData(type);
    if (type === 'gmail') autoSyncGarenaFromGmail();
    render(type);
    closeModal('importModal');
    toast(`Đã import thành công ${data.length} tài khoản`);
  }

  // === MODAL: EXPORT ===
  function openExportModal(type) {
    state.exportType = type;
    document.getElementById('exportModalTitle').textContent = 'Export tài khoản ' + CONFIG[type].label;
    openModal('exportModal');
  }
  function doExport(format) {
    const type = state.exportType, cfg = CONFIG[type], data = getSorted(type);
    const ts = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      const headers = cfg.fields.map(f => f.label).concat(['Đã đăng nhập']);
      const csvRows = data.map(acc => {
        const vals = cfg.fields.map(f => csvEsc(acc[f.key] || ''));
        vals.push(acc.daDangNhap ? 'Có' : 'Chưa');
        return vals.join(',');
      });
      downloadFile('\uFEFF' + headers.join(',') + '\n' + csvRows.join('\n'), `${type}_${ts}.csv`, 'text/csv;charset=utf-8');
    } else {
      downloadFile(JSON.stringify(data, null, 2), `${type}_${ts}.json`, 'application/json');
    }
    closeModal('exportModal');
    toast(`Đã xuất file ${format.toUpperCase()}`);
  }
  function csvEsc(s) {
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadFile(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }

  // === MODAL HELPERS ===
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModalDirect(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    document.body.style.overflow = '';
  }

  function closeModal(id) {
    if (id === 'confirmModal' && state.confirmResolver) {
      state.confirmResolver(false);
      return;
    }
    closeModalDirect(id);
  }

  function setupModalClose() {
    document.querySelectorAll('.modal-overlay').forEach(o => {
      o.addEventListener('click', e => {
        if (e.target === o) {
          closeModal(o.id);
        }
      });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
      }
    });
  }

  // === THEME ===
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.innerHTML = t === 'dark' ? SUN_ICON : MOON_ICON;
      btn.title = t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
      btn.className = 'header-icon-btn btn-theme';
    }
    localStorage.setItem('app_theme', t);
  }

  function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(curr === 'dark' ? 'light' : 'dark');
  }

  // === TÌM KIẾM ===
  function setupSearch() {
    const input = document.getElementById('searchInput');
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.searchTerm = input.value.trim();
        TYPES.forEach(t => {
          state.page[t] = 1;
          render(t);
        });
      }, 200);
    });
  }

  // === INIT ===
  function init() {
    loadData();
    TYPES.forEach(t => render(t));
    setupSearch();
    setupModalClose();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    toggleCheck, deleteAccount,
    resetAllEvents, deleteAllAccounts,
    changePage,
    openSnapshotModal, saveOrderSnapshot, restoreOrderSnapshot, deleteOrderSnapshot,
    openAddModal, submitAddForm,
    openEditModal, submitEditForm,
    openImportModal, previewImport, confirmImport,
    openExportModal, doExport,
    closeModal, openModal
  };
})();
