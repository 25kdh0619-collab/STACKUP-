// ─── State ────────────────────────────────────────────────────────────────────
const TYPE_META = {
  bag:    { emoji: '🎒', label: '가방' },
  drawer: { emoji: '🗄️', label: '서랍' },
  closet: { emoji: '👕', label: '옷장' },
  desk:   { emoji: '🖥️', label: '책상' },
  locker: { emoji: '🔒', label: '사물함' },
  shelf:  { emoji: '📚', label: '선반' },
};

const COLOR_DOTS = {
  blue:'#3b82f6', green:'#22c55e', amber:'#f59e0b',
  pink:'#ec4899', purple:'#8b5cf6', red:'#ef4444', gray:'#9ca3af'
};

let state = loadState();
let currentSpaceId = null;
let editingCellId = null;
let isListView = false;

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem('packmap-v1');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { spaces: getDefaultSpaces() };
}

function saveState() {
  localStorage.setItem('packmap-v1', JSON.stringify(state));
}

function getDefaultSpaces() {
  return [
    {
      id: uid(), name: '여행 백팩', type: 'bag',
      cells: [
        { id: uid(), name: '케이블 파우치', icon: '🔌', color: 'blue',
          items: ['USB-C 케이블', '충전기 (65W)', '이어폰', '멀티탭'] },
        { id: uid(), name: '서류 파우치', icon: '📄', color: 'amber',
          items: ['여권', '항공권 출력본', '여행자 보험 서류'] },
        { id: uid(), name: '의약품', icon: '💊', color: 'red',
          items: ['타이레놀', '소화제', '밴드', '체온계'] },
        { id: uid(), name: '세면도구', icon: '🧴', color: 'green',
          items: ['샴푸 (미니)', '선크림', '칫솔·치약', '클렌징 폼'] },
        { id: uid(), name: '지갑·카드', icon: '💳', color: 'purple',
          items: ['신용카드', '현금 (달러)', '교통카드'] },
        { id: uid(), name: '카메라', icon: '📸', color: 'pink',
          items: ['카메라 본체', '렌즈', '배터리 x2', 'SD 카드'] },
      ]
    },
    {
      id: uid(), name: '책상 서랍', type: 'drawer',
      cells: [
        { id: uid(), name: '문구류', icon: '📚', color: 'amber',
          items: ['볼펜', '형광펜', '포스트잇', '가위'] },
        { id: uid(), name: '전자기기', icon: '🔌', color: 'blue',
          items: ['USB 허브', '마우스 패드', '이어폰'] },
      ]
    }
  ];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('space-list');
  list.innerHTML = '';
  state.spaces.forEach(space => {
    const meta = TYPE_META[space.type] || TYPE_META.bag;
    const div = document.createElement('div');
    div.className = 'space-item' + (space.id === currentSpaceId ? ' active' : '');
    div.innerHTML = `
      <span class="space-emoji">${meta.emoji}</span>
      <span class="space-name">${escHtml(space.name)}</span>
      <span class="space-count">${space.cells.length}</span>
    `;
    div.onclick = () => selectSpace(space.id);
    list.appendChild(div);
  });
}

function renderEditor() {
  const space = state.spaces.find(s => s.id === currentSpaceId);
  if (!space) return;

  const meta = TYPE_META[space.type] || TYPE_META.bag;
  document.getElementById('editor-type-badge').textContent = meta.emoji;
  document.getElementById('editor-title').textContent = space.name;

  const totalItems = space.cells.reduce((n, c) => n + c.items.length, 0);
  document.getElementById('editor-item-count').textContent =
    `${space.cells.length}개 셀 · ${totalItems}개 아이템`;

  renderGrid(space);
  if (isListView) renderListView(space);
}

function renderGrid(space) {
  const grid = document.getElementById('cell-grid');
  grid.innerHTML = '';
  space.cells.forEach(cell => {
    const card = document.createElement('div');
    card.className = `cell-card ${cell.color}`;
    card.innerHTML = `
      <span class="cell-icon-large">${cell.icon}</span>
      <div class="cell-name">${escHtml(cell.name)}</div>
      <div class="cell-items-preview">${cell.items.map(escHtml).join('\n')}</div>
      ${cell.items.length > 0 ? `<span class="cell-count-badge">${cell.items.length}</span>` : ''}
      <button class="cell-edit-btn" title="편집" onclick="event.stopPropagation(); openCellEdit('${cell.id}')">✏️</button>
    `;
    card.onclick = () => openCellEdit(cell.id);
    grid.appendChild(card);
  });
}

function renderListView(space) {
  const body = document.getElementById('list-body');
  body.innerHTML = '';
  space.cells.forEach(cell => {
    cell.items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div class="list-item-name">
          <span class="list-dot" style="background:${COLOR_DOTS[cell.color]}"></span>
          ${escHtml(item)}
        </div>
        <div>${escHtml(cell.name)}</div>
        <div style="color:var(--muted)">1</div>
        <div><span class="list-tag">${escHtml(TYPE_META[space.type]?.label || '기타')}</span></div>
      `;
      body.appendChild(row);
    });
  });
}

// ─── Space Actions ────────────────────────────────────────────────────────────
function selectSpace(id) {
  currentSpaceId = id;
  isListView = false;
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('editor').style.display = 'block';
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('cell-grid').style.display = 'grid';
  document.getElementById('toggle-view-btn').textContent = '목록 보기';
  renderSidebar();
  renderEditor();
}

function addSpace(name, type) {
  const space = { id: uid(), name, type, cells: [] };
  state.spaces.push(space);
  saveState();
  selectSpace(space.id);
}

function deleteCurrentSpace() {
  if (!currentSpaceId) return;
  if (!confirm('이 공간을 삭제할까요?')) return;
  state.spaces = state.spaces.filter(s => s.id !== currentSpaceId);
  saveState();
  currentSpaceId = null;
  document.getElementById('editor').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
  renderSidebar();
  showToast('공간을 삭제했어요.');
}

// ─── Cell Actions ─────────────────────────────────────────────────────────────
function openCellAdd() {
  editingCellId = null;
  document.getElementById('cell-modal-title').textContent = '셀 추가';
  document.getElementById('cell-name-input').value = '';
  document.getElementById('cell-items-input').value = '';
  setActiveSelector('color-selector', 'color-btn', 'blue');
  setActiveSelector('icon-selector', 'icon-btn', '📦');
  document.getElementById('cell-modal-overlay').classList.add('open');
  document.getElementById('cell-name-input').focus();
}

function openCellEdit(cellId) {
  const space = state.spaces.find(s => s.id === currentSpaceId);
  const cell = space?.cells.find(c => c.id === cellId);
  if (!cell) return;
  editingCellId = cellId;
  document.getElementById('cell-modal-title').textContent = '셀 편집';
  document.getElementById('cell-name-input').value = cell.name;
  document.getElementById('cell-items-input').value = cell.items.join('\n');
  setActiveSelector('color-selector', 'color-btn', cell.color);
  setActiveSelector('icon-selector', 'icon-btn', cell.icon);
  document.getElementById('cell-modal-overlay').classList.add('open');
  document.getElementById('cell-name-input').focus();
}

function saveCellModal() {
  const name = document.getElementById('cell-name-input').value.trim();
  if (!name) { showToast('셀 이름을 입력하세요.'); return; }

  const rawItems = document.getElementById('cell-items-input').value;
  const items = rawItems.split('\n').map(s => s.trim()).filter(Boolean);
  const color = document.querySelector('#color-selector .color-btn.active')?.dataset.color || 'blue';
  const icon = document.querySelector('#icon-selector .icon-btn.active')?.dataset.icon || '📦';

  const space = state.spaces.find(s => s.id === currentSpaceId);
  if (!space) return;

  if (editingCellId) {
    const cell = space.cells.find(c => c.id === editingCellId);
    if (cell) Object.assign(cell, { name, items, color, icon });
    showToast('셀을 업데이트했어요.');
  } else {
    space.cells.push({ id: uid(), name, items, color, icon });
    showToast('셀을 추가했어요.');
  }

  saveState();
  closeCellModal();
  renderEditor();
  renderSidebar();
}

function closeCellModal() {
  document.getElementById('cell-modal-overlay').classList.remove('open');
  editingCellId = null;
}

// ─── Space Modal ──────────────────────────────────────────────────────────────
let selectedSpaceType = 'bag';

function openSpaceModal() {
  selectedSpaceType = 'bag';
  document.getElementById('space-name-input').value = '';
  setActiveSelector('type-selector', 'type-btn', 'bag');
  document.getElementById('space-modal-overlay').classList.add('open');
  document.getElementById('space-name-input').focus();
}

function closeSpaceModal() {
  document.getElementById('space-modal-overlay').classList.remove('open');
}

function saveSpaceModal() {
  const name = document.getElementById('space-name-input').value.trim();
  if (!name) { showToast('공간 이름을 입력하세요.'); return; }
  addSpace(name, selectedSpaceType);
  closeSpaceModal();
  showToast(`"${name}" 공간을 만들었어요.`);
}

// ─── Toggle View ──────────────────────────────────────────────────────────────
function toggleView() {
  isListView = !isListView;
  const grid = document.getElementById('cell-grid');
  const listView = document.getElementById('list-view');
  const addBtn = document.getElementById('add-cell-btn');
  const toggleBtn = document.getElementById('toggle-view-btn');

  if (isListView) {
    grid.style.display = 'none';
    addBtn.style.display = 'none';
    listView.style.display = 'block';
    toggleBtn.textContent = '격자 보기';
    const space = state.spaces.find(s => s.id === currentSpaceId);
    if (space) renderListView(space);
  } else {
    grid.style.display = 'grid';
    addBtn.style.display = 'flex';
    listView.style.display = 'none';
    toggleBtn.textContent = '목록 보기';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setActiveSelector(containerId, btnClass, value) {
  document.querySelectorAll(`#${containerId} .${btnClass}`).forEach(btn => {
    const isMatch = btn.dataset.color === value || btn.dataset.type === value || btn.dataset.icon === value;
    btn.classList.toggle('active', isMatch);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── Event Binding ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar
  document.getElementById('add-space-btn').onclick = openSpaceModal;

  // Editor actions
  document.getElementById('add-cell-btn').onclick = openCellAdd;
  document.getElementById('delete-space-btn').onclick = deleteCurrentSpace;
  document.getElementById('toggle-view-btn').onclick = toggleView;

  // Title edit
  document.getElementById('editor-title').addEventListener('input', e => {
    const space = state.spaces.find(s => s.id === currentSpaceId);
    if (space) { space.name = e.target.textContent.trim(); saveState(); renderSidebar(); }
  });

  // Space modal
  document.getElementById('space-modal-cancel').onclick = closeSpaceModal;
  document.getElementById('space-modal-confirm').onclick = saveSpaceModal;
  document.getElementById('space-name-input').onkeydown = e => { if (e.key === 'Enter') saveSpaceModal(); };
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => {
      selectedSpaceType = btn.dataset.type;
      setActiveSelector('type-selector', 'type-btn', selectedSpaceType);
    };
  });
  document.getElementById('space-modal-overlay').onclick = e => {
    if (e.target === e.currentTarget) closeSpaceModal();
  };

  // Cell modal
  document.getElementById('cell-modal-cancel').onclick = closeCellModal;
  document.getElementById('cell-modal-confirm').onclick = saveCellModal;
  document.getElementById('cell-modal-overlay').onclick = e => {
    if (e.target === e.currentTarget) closeCellModal();
  };
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.onclick = () => setActiveSelector('color-selector', 'color-btn', btn.dataset.color);
  });
  document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.onclick = () => setActiveSelector('icon-selector', 'icon-btn', btn.dataset.icon);
  });

  // Init
  renderSidebar();
  if (state.spaces.length > 0) selectSpace(state.spaces[0].id);
});
