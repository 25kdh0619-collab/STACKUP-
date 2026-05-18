// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_META = {
  bag:    { emoji:'🎒', label:'가방' },
  drawer: { emoji:'🗄️', label:'서랍' },
  closet: { emoji:'👕', label:'옷장' },
  desk:   { emoji:'🖥️', label:'책상' },
  locker: { emoji:'🔒', label:'사물함' },
  shelf:  { emoji:'📚', label:'선반' },
};

const COLOR_DOT = {
  blue:'#3B82F6', indigo:'#6366F1', green:'#22C55E',
  amber:'#F59E0B', pink:'#EC4899', red:'#EF4444', slate:'#64748B'
};

// ── State ───────────────────────────────────────────────────────────────────────
let state = loadState();
let currentSpaceId = null;
let editingCellId = null;
let isListView = false;

// Drag state
let dragging = null; // { cellId, startX, startY, origLeft, origTop }

// ── Persistence ─────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem('stackup-v2');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { spaces: defaultSpaces() };
}

function save() {
  localStorage.setItem('stackup-v2', JSON.stringify(state));
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function defaultSpaces() {
  return [
    {
      id: uid(), name: '여행 백팩', type: 'bag',
      cells: [
        { id:uid(), name:'케이블', icon:'🔌', color:'blue', x:16, y:16,
          items:['USB-C 케이블','충전기 65W','이어폰','멀티탭'] },
        { id:uid(), name:'서류', icon:'📄', color:'amber', x:180, y:16,
          items:['여권','항공권','보험 서류'] },
        { id:uid(), name:'의약품', icon:'💊', color:'red', x:344, y:16,
          items:['타이레놀','소화제','밴드'] },
        { id:uid(), name:'세면도구', icon:'🧴', color:'green', x:16, y:160,
          items:['샴푸','선크림','칫솔'] },
        { id:uid(), name:'지갑', icon:'💳', color:'indigo', x:180, y:160,
          items:['신용카드','현금','교통카드'] },
      ]
    },
    {
      id: uid(), name: '책상 서랍', type: 'desk',
      cells: [
        { id:uid(), name:'문구류', icon:'📚', color:'amber', x:16, y:16,
          items:['볼펜','형광펜','포스트잇'] },
        { id:uid(), name:'전자기기', icon:'🔌', color:'blue', x:180, y:16,
          items:['USB 허브','마우스'] },
      ]
    }
  ];
}

// ── Render ───────────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('space-list');
  list.innerHTML = '';
  state.spaces.forEach(sp => {
    const meta = TYPE_META[sp.type] || TYPE_META.bag;
    const el = document.createElement('div');
    el.className = 'space-item' + (sp.id === currentSpaceId ? ' active' : '');
    el.innerHTML = `
      <span class="s-emoji">${meta.emoji}</span>
      <span class="s-name">${esc(sp.name)}</span>
      <span class="s-count">${sp.cells.length}</span>`;
    el.onclick = () => selectSpace(sp.id);
    list.appendChild(el);
  });
}

function renderEditor() {
  const sp = currentSpace();
  if (!sp) return;
  const meta = TYPE_META[sp.type] || TYPE_META.bag;
  document.getElementById('editor-emoji').textContent = meta.emoji;
  document.getElementById('editor-title').textContent = sp.name;
  const total = sp.cells.reduce((n,c) => n + c.items.length, 0);
  document.getElementById('editor-meta').textContent = `${sp.cells.length}개 셀 · ${total}개 아이템`;
  renderCanvas(sp);
  updateCanvasHint(sp);
  if (isListView) renderListView(sp);
}

function renderCanvas(sp) {
  const canvas = document.getElementById('cell-canvas');
  canvas.innerHTML = '';
  sp.cells.forEach(cell => canvas.appendChild(makeCard(cell)));
}

function makeCard(cell) {
  const div = document.createElement('div');
  div.className = `cell-card ${cell.color}`;
  div.dataset.id = cell.id;
  div.style.left = (cell.x || 16) + 'px';
  div.style.top  = (cell.y || 16) + 'px';

  const preview = cell.items.slice(0, 3).join('\n') + (cell.items.length > 3 ? '\n…' : '');
  div.innerHTML = `
    <span class="cell-icon">${cell.icon}</span>
    <div class="cell-name">${esc(cell.name)}</div>
    <div class="cell-preview">${esc(preview)}</div>
    ${cell.items.length ? `<span class="cell-count">${cell.items.length}</span>` : ''}
    <button class="cell-edit" title="편집" onclick="event.stopPropagation();openCellEdit('${cell.id}')">✏️</button>`;

  // Drag
  div.addEventListener('mousedown', dragStart);
  div.addEventListener('touchstart', dragStartTouch, { passive: false });

  return div;
}

function updateCanvasHint(sp) {
  const hint = document.querySelector('.canvas-hint');
  if (hint) hint.classList.toggle('hidden', sp.cells.length > 0);
}

function renderListView(sp) {
  const tbody = document.getElementById('list-body');
  tbody.innerHTML = '';
  sp.cells.forEach(cell => {
    cell.items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="list-dot" style="background:${COLOR_DOT[cell.color]}"></span>${esc(item)}</td>
        <td>${esc(cell.name)}</td>
        <td style="color:var(--muted)">1</td>`;
      tbody.appendChild(tr);
    });
  });
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────────
function dragStart(e) {
  if (e.target.classList.contains('cell-edit')) return;
  e.preventDefault();
  const card = e.currentTarget;
  startDrag(card, e.clientX, e.clientY);
}

function dragStartTouch(e) {
  if (e.target.classList.contains('cell-edit')) return;
  e.preventDefault();
  const card = e.currentTarget;
  const touch = e.touches[0];
  startDrag(card, touch.clientX, touch.clientY);
}

function startDrag(card, clientX, clientY) {
  const sp = currentSpace();
  const cell = sp.cells.find(c => c.id === card.dataset.id);
  if (!cell) return;

  dragging = {
    card,
    cellId: cell.id,
    startX: clientX,
    startY: clientY,
    origLeft: cell.x || 16,
    origTop:  cell.y || 16,
  };
  card.classList.add('dragging');
}

document.addEventListener('mousemove', onDragMove);
document.addEventListener('touchmove', onDragMoveTouch, { passive: false });

function onDragMove(e) { if (dragging) moveDrag(e.clientX, e.clientY); }
function onDragMoveTouch(e) {
  if (dragging) { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }
}

function moveDrag(clientX, clientY) {
  const dx = clientX - dragging.startX;
  const dy = clientY - dragging.startY;
  const newLeft = Math.max(0, dragging.origLeft + dx);
  const newTop  = Math.max(0, dragging.origTop  + dy);
  dragging.card.style.left = newLeft + 'px';
  dragging.card.style.top  = newTop  + 'px';
}

document.addEventListener('mouseup',  stopDrag);
document.addEventListener('touchend', stopDrag);

function stopDrag() {
  if (!dragging) return;
  const sp = currentSpace();
  const cell = sp.cells.find(c => c.id === dragging.cellId);
  if (cell) {
    cell.x = parseInt(dragging.card.style.left);
    cell.y = parseInt(dragging.card.style.top);
    save();
  }
  dragging.card.classList.remove('dragging');
  dragging = null;
}

// ── Space Actions ────────────────────────────────────────────────────────────────
function selectSpace(id) {
  currentSpaceId = id;
  isListView = false;
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('editor').style.display = 'block';
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('cell-canvas').style.display = 'block';
  document.getElementById('add-cell-btn').style.display = 'flex';
  document.getElementById('toggle-view-btn').textContent = '목록 보기';
  renderSidebar();
  renderEditor();
}

function deleteCurrentSpace() {
  if (!currentSpaceId) return;
  if (!confirm('이 공간을 삭제할까요?')) return;
  state.spaces = state.spaces.filter(s => s.id !== currentSpaceId);
  save();
  currentSpaceId = null;
  document.getElementById('editor').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
  renderSidebar();
  toast('공간을 삭제했어요.');
}

// ── Cell Actions ─────────────────────────────────────────────────────────────────
function openCellAdd() {
  editingCellId = null;
  document.getElementById('cell-modal-title').textContent = '셀 추가';
  document.getElementById('cell-name-input').value = '';
  document.getElementById('cell-items-input').value = '';
  document.getElementById('cell-delete-btn').style.display = 'none';
  setActive('color-selector', 'color-swatch', 'blue', 'color');
  setActive('icon-selector',  'icon-opt',     '📦',  'icon');
  document.getElementById('cell-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('cell-name-input').focus(), 80);
}

function openCellEdit(cellId) {
  const cell = currentSpace()?.cells.find(c => c.id === cellId);
  if (!cell) return;
  editingCellId = cellId;
  document.getElementById('cell-modal-title').textContent = '셀 편집';
  document.getElementById('cell-name-input').value = cell.name;
  document.getElementById('cell-items-input').value = cell.items.join('\n');
  document.getElementById('cell-delete-btn').style.display = 'block';
  setActive('color-selector', 'color-swatch', cell.color, 'color');
  setActive('icon-selector',  'icon-opt',     cell.icon,  'icon');
  document.getElementById('cell-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('cell-name-input').focus(), 80);
}

function saveCellModal() {
  const name = document.getElementById('cell-name-input').value.trim();
  if (!name) { toast('셀 이름을 입력하세요.'); return; }
  const items = document.getElementById('cell-items-input').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const color = document.querySelector('#color-selector .color-swatch.active')?.dataset.color || 'blue';
  const icon  = document.querySelector('#icon-selector .icon-opt.active')?.dataset.icon || '📦';
  const sp = currentSpace();
  if (!sp) return;

  if (editingCellId) {
    const cell = sp.cells.find(c => c.id === editingCellId);
    if (cell) Object.assign(cell, { name, items, color, icon });
    toast('업데이트했어요.');
  } else {
    // Place new cell in next available spot
    const lastCell = sp.cells[sp.cells.length - 1];
    const x = lastCell ? (lastCell.x + 164) % 492 : 16;
    const y = lastCell ? lastCell.y + (lastCell.x + 164 >= 492 ? 144 : 0) : 16;
    sp.cells.push({ id:uid(), name, items, color, icon, x, y });
    toast('셀을 추가했어요.');
  }
  save();
  closeCellModal();
  renderEditor();
  renderSidebar();
}

function deleteCellInModal() {
  if (!editingCellId) return;
  if (!confirm('이 셀을 삭제할까요?')) return;
  const sp = currentSpace();
  sp.cells = sp.cells.filter(c => c.id !== editingCellId);
  save();
  closeCellModal();
  renderEditor();
  renderSidebar();
  toast('셀을 삭제했어요.');
}

function closeCellModal() {
  document.getElementById('cell-modal-overlay').classList.remove('open');
  editingCellId = null;
}

// ── Space Modal ──────────────────────────────────────────────────────────────────
let selectedType = 'bag';

function openSpaceModal() {
  selectedType = 'bag';
  document.getElementById('space-name-input').value = '';
  setActive('type-selector', 'type-btn', 'bag', 'type');
  document.getElementById('space-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('space-name-input').focus(), 80);
}

function closeSpaceModal() { document.getElementById('space-modal-overlay').classList.remove('open'); }

function saveSpaceModal() {
  const name = document.getElementById('space-name-input').value.trim();
  if (!name) { toast('이름을 입력하세요.'); return; }
  const sp = { id:uid(), name, type:selectedType, cells:[] };
  state.spaces.push(sp);
  save();
  closeSpaceModal();
  selectSpace(sp.id);
  toast(`"${name}" 공간을 만들었어요.`);
}

// ── Toggle View ──────────────────────────────────────────────────────────────────
function toggleView() {
  isListView = !isListView;
  const canvas  = document.getElementById('canvas-wrapper');
  const listView = document.getElementById('list-view');
  const toggleBtn = document.getElementById('toggle-view-btn');
  if (isListView) {
    canvas.style.display = 'none';
    listView.style.display = 'block';
    toggleBtn.textContent = '격자 보기';
    const sp = currentSpace();
    if (sp) renderListView(sp);
  } else {
    canvas.style.display = 'block';
    listView.style.display = 'none';
    toggleBtn.textContent = '목록 보기';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────
function currentSpace() { return state.spaces.find(s => s.id === currentSpaceId); }

function setActive(containerId, btnClass, value, dataKey) {
  document.querySelectorAll(`#${containerId} .${btnClass}`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset[dataKey] === value);
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Init ─────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar
  document.getElementById('add-space-btn').onclick = openSpaceModal;

  // Editor
  document.getElementById('add-cell-btn').onclick = openCellAdd;
  document.getElementById('delete-space-btn').onclick = deleteCurrentSpace;
  document.getElementById('toggle-view-btn').onclick = toggleView;
  document.getElementById('editor-title').addEventListener('input', e => {
    const sp = currentSpace();
    if (sp) { sp.name = e.target.textContent.trim(); save(); renderSidebar(); }
  });

  // Space modal
  document.getElementById('add-space-btn').onclick = openSpaceModal;
  document.getElementById('space-modal-cancel').onclick = closeSpaceModal;
  document.getElementById('space-modal-close').onclick  = closeSpaceModal;
  document.getElementById('space-modal-confirm').onclick = saveSpaceModal;
  document.getElementById('space-name-input').onkeydown = e => { if (e.key==='Enter') saveSpaceModal(); };
  document.getElementById('space-modal-overlay').onclick = e => { if (e.target===e.currentTarget) closeSpaceModal(); };
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => { selectedType = btn.dataset.type; setActive('type-selector','type-btn',selectedType,'type'); };
  });

  // Cell modal
  document.getElementById('cell-modal-cancel').onclick  = closeCellModal;
  document.getElementById('cell-modal-close').onclick   = closeCellModal;
  document.getElementById('cell-modal-confirm').onclick = saveCellModal;
  document.getElementById('cell-delete-btn').onclick    = deleteCellInModal;
  document.getElementById('cell-modal-overlay').onclick = e => { if (e.target===e.currentTarget) closeCellModal(); };
  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.onclick = () => setActive('color-selector','color-swatch', btn.dataset.color,'color');
  });
  document.querySelectorAll('.icon-opt').forEach(btn => {
    btn.onclick = () => setActive('icon-selector','icon-opt', btn.dataset.icon,'icon');
  });

  // Init
  renderSidebar();
  if (state.spaces.length > 0) selectSpace(state.spaces[0].id);
});
