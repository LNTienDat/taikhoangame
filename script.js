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
        { key: 'tenGarena', label: 'Tên tài khoản Garena', required: true },
        { key: 'gmailDangKy', label: 'Gmail liên kết (dùng khi khôi phục)', required: false },
        { key: 'tenNhanVat', label: 'Tên nhân vật game', required: false }
      ],
      importColumns: ['tenGarena', 'gmailDangKy', 'tenNhanVat'],
      importHint: 'Tên Garena | Gmail liên kết | Tên nhân vật'
    },
    gmail: {
      storageKey: 'gmail_accounts',
      mainField: 'gmail',
      label: 'Gmail',
      fields: [
        { key: 'gmail', label: 'Địa chỉ Gmail', required: true },
        { key: 'tenNhanVat', label: 'Tên nhân vật game', required: false }
      ],
      importColumns: ['gmail', 'tenNhanVat'],
      importHint: 'Địa chỉ Gmail | Tên nhân vật'
    },
    facebook: {
      storageKey: 'facebook_accounts',
      mainField: 'facebook',
      label: 'Facebook',
      fields: [
        { key: 'facebook', label: 'Tên tài khoản Facebook', required: true },
        { key: 'tenNhanVat', label: 'Tên nhân vật game', required: false }
      ],
      importColumns: ['facebook', 'tenNhanVat'],
      importHint: 'Tên Facebook | Tên nhân vật'
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

  // === LOCALSTORAGE ===
  function loadData() {
    TYPES.forEach(t => {
      try { const r = localStorage.getItem(CONFIG[t].storageKey); state[t] = r ? JSON.parse(r) : []; }
      catch { state[t] = []; }
    });
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
    render(type);
    toast('Đã thêm tài khoản');
  }
  function addAccountSilent(type, data) {
    state[type].push({ id: uuid(), daDangNhap: false, ...data });
  }
  function updateAccount(type, id, updates) {
    const acc = state[type].find(a => a.id === id);
    if (acc) { Object.assign(acc, updates); saveData(type); render(type); }
  }
  function deleteAccount(type, id) {
    const acc = state[type].find(a => a.id === id);
    const name = acc ? (acc[CONFIG[type].mainField] || 'tài khoản này') : 'tài khoản này';
    if (!confirm(`Bạn có chắc muốn xoá "${name}" không?`)) return;
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
      sorted = sorted.filter(acc => matchSearch(acc[CONFIG[type].mainField] || '', term));
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

  // Dòng tài khoản dạng cột: [⠿ Kéo thả] [Checkbox] [Tên trong game | Tên tài khoản] [✏️ 🗑️]
  function renderRow(type, acc) {
    const cfg = CONFIG[type];
    const term = state.searchTerm;
    const mainText = highlightText(acc[cfg.mainField] || '', term);
    const gameName = acc.tenNhanVat ? escapeHtml(acc.tenNhanVat) : '<span style="color:var(--text-muted)">—</span>';
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
        <span class="col-acc" title="Tên đăng nhập">${mainText}</span>
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

        // Tự động lật sang trang đó sau 450ms rê chuột
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

        // Chuyển tài khoản vào đầu trang mục tiêu
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

  // === 2 BẢN SAO LƯU VỊ TRÍ TÀI KHOẢN (SLOT 1 & SLOT 2) ===
  function openSnapshotModal(type) {
    state.snapshotType = type;
    const cfg = CONFIG[type];
    document.getElementById('snapshotModalTitle').textContent = 'Sao lưu vị trí tài khoản ' + cfg.label;

    [1, 2].forEach(slot => {
      const snapKey = `${type}_order_snapshot_${slot}`;
      const raw = localStorage.getItem(snapKey);
      const timeEl = document.getElementById(`slotTime${slot}`);
      const btnRestore = document.getElementById(`btnRestore${slot}`);

      if (raw) {
        try {
          const snap = JSON.parse(raw);
          const countText = snap.count ? ` (${snap.count} tài khoản)` : '';
          timeEl.textContent = snap.time + countText;
          btnRestore.disabled = false;
        } catch {
          timeEl.textContent = 'Chưa có';
          btnRestore.disabled = true;
        }
      } else {
        timeEl.textContent = 'Chưa có';
        btnRestore.disabled = true;
      }
    });

    openModal('snapshotModal');
  }

  function saveOrderSnapshot(slot) {
    const type = state.snapshotType;
    if (!type) return;
    const cfg = CONFIG[type];
    const snap = {
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN'),
      count: state[type].length,
      order: state[type].map(a => a.id)
    };
    localStorage.setItem(`${type}_order_snapshot_${slot}`, JSON.stringify(snap));
    openSnapshotModal(type); // Cập nhật lại thời gian hiển thị ngay lập tức
    toast(`Đã lưu vị trí vào Bản sao lưu ${slot}!`);
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
      const idMap = new Map();
      state[type].forEach(a => idMap.set(a.id, a));

      const reordered = [];
      snap.order.forEach(id => {
        if (idMap.has(id)) {
          reordered.push(idMap.get(id));
          idMap.delete(id);
        }
      });
      // Những tài khoản mới thêm vào sau bản lưu thì giữ ở cuối
      idMap.forEach(a => reordered.push(a));

      state[type] = reordered;
      saveData(type);
      render(type);
      closeModal('snapshotModal');
      toast(`Đã khôi phục về Bản sao lưu ${slot}!`);
    } catch {
      toast('Lỗi khi khôi phục dữ liệu bản lưu');
    }
  }

  // === RESET SỰ KIỆN CHUNG (2 LẦN XÁC NHẬN) ===
  function resetAllEvents() {
    const step1 = confirm('Bạn có chắc chắn muốn Reset trạng thái đăng nhập của TẤT CẢ tài khoản không?');
    if (!step1) return;

    const step2 = confirm('XÁC NHẬN LẦN CUỐI: Bạn có thực sự muốn Reset toàn bộ sự kiện không?');
    if (!step2) return;

    TYPES.forEach(t => {
      state[t].forEach(a => { a.daDangNhap = false; });
      saveData(t);
      render(t);
    });
    toast('Đã reset sự kiện tất cả tài khoản');
  }

  // === XOÁ TẤT CẢ TÀI KHOẢN (2 LẦN XÁC NHẬN) ===
  function deleteAllAccounts() {
    const total = TYPES.reduce((sum, t) => sum + state[t].length, 0);
    if (total === 0) {
      toast('Hiện không có tài khoản nào để xoá');
      return;
    }

    const step1 = confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XOÁ TOÀN BỘ ${total} TÀI KHOẢN (Garena, Gmail, Facebook) không?`);
    if (!step1) return;

    const step2 = confirm('XÁC NHẬN LẦN CUỐI: Toàn bộ dữ liệu tài khoản sẽ bị xoá vĩnh viễn và không thể khôi phục. Bạn vẫn muốn xoá chứ?');
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
      cfg.importColumns.forEach((k, i) => { row[k] = (cols[i] || '').trim(); });
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
    saveData(type); render(type);
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
  function openModal(id) { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }
  function setupModalClose() {
    document.querySelectorAll('.modal-overlay').forEach(o => {
      o.addEventListener('click', e => { if (e.target === o) { o.classList.remove('active'); document.body.style.overflow = ''; } });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        document.body.style.overflow = '';
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
    openSnapshotModal, saveOrderSnapshot, restoreOrderSnapshot,
    openAddModal, submitAddForm,
    openEditModal, submitEditForm,
    openImportModal, previewImport, confirmImport,
    openExportModal, doExport,
    closeModal, openModal
  };
})();
