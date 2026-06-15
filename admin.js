// ── Auth guard ───────────────────────────────────────────
if (sessionStorage.getItem('kl7_admin') !== 'true') {
  window.location.href = 'admin-login.html';
}

// ── Theme Management ─────────────────────────────────────
function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeIconLight').style.display = 'none';
    document.getElementById('themeIconDark').style.display = 'block';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeIconDark').style.display = 'none';
    document.getElementById('themeIconLight').style.display = 'block';
  }
  localStorage.setItem('kl7_admin_theme', theme);
  const select = document.getElementById('themeSelect');
  if (select) select.value = theme;
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(isDark ? 'light' : 'dark');
}

// Initialize theme
const savedTheme = localStorage.getItem('kl7_admin_theme') || 'light';
setTheme(savedTheme);

// ── Tab switching ────────────────────────────────────────
const NAV_LINKS = document.querySelectorAll('.sb-link[data-tab]');
const TABS = document.querySelectorAll('.tab-content');
const TOPBAR_TITLE = document.getElementById('topbarTitle');

const TAB_LABELS = {
  home: 'Overview',
  inventory: 'Inventory',
  'sell-requests': 'Sell Requests',
  enquiries: 'Enquiries',
  gallery: 'Gallery',
  settings: 'Settings'
};

function switchTab(tabId) {
  NAV_LINKS.forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
  TABS.forEach(t => t.classList.toggle('active', t.id === 'tab-' + tabId));
  if (TOPBAR_TITLE) TOPBAR_TITLE.textContent = TAB_LABELS[tabId] || tabId;
  if (window.innerWidth < 900) closeSidebar();
}

NAV_LINKS.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    switchTab(link.dataset.tab);
  });
});

// ── Mobile sidebar ───────────────────────────────────────
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth >= 900) {
    sidebar.classList.remove('collapsed');
  } else {
    sidebar.classList.add('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth >= 900) {
    sidebar.classList.toggle('collapsed');
  } else {
    sidebar.classList.remove('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ── Notifications ────────────────────────────────────────
function toggleNotifications() {
  document.getElementById('notifDropdown').classList.toggle('open');
}

function markAllNotifsRead() {
  document.querySelectorAll('#notifList .notif-item.unread').forEach(item => {
    item.classList.remove('unread');
  });
  const dot = document.getElementById('notifDot');
  if (dot) dot.classList.add('hidden');
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('notifWrap');
  const dropdown = document.getElementById('notifDropdown');
  if (!wrap || !dropdown) return;
  if (!wrap.contains(e.target)) dropdown.classList.remove('open');
});

// ── Logout ───────────────────────────────────────────────
function logout() {
  if (confirm('Sign out of KL7 Garage admin?')) {
    sessionStorage.removeItem('kl7_admin');
    window.location.href = 'admin-login.html';
  }
}

// ══════════════════════════════════════════════════════════
//  BIKE MODAL (Add / Edit)
// ══════════════════════════════════════════════════════════
let editingRow = null;
let selectedFiles = [];

function openAddBike() {
  editingRow = null;
  selectedFiles = [];
  document.getElementById('modalTitle').textContent = 'Add New Bike';
  document.getElementById('saveBtn').textContent = 'Add to Inventory';
  clearForm();
  document.getElementById('bikeModal').classList.add('open');
}

function openEditBike(btn) {
  const row = btn.closest('tr');
  editingRow = row;

  // Pre-fill from row data
  const name = row.querySelector('.bike-name')?.textContent || '';
  const brand = row.querySelector('.bike-brand')?.textContent.split(' · ')[0] || '';
  const color = row.querySelector('.bike-brand')?.textContent.split(' · ')[1] || '';
  const year = row.cells[1]?.textContent || '';
  const price = row.cells[2]?.textContent.replace('₹', '').trim() || '';
  const km = row.cells[3]?.textContent.replace(' km', '').trim() || '';
  const statusText = row.querySelector('.badge')?.textContent.toLowerCase() || 'active';

  document.getElementById('f-name').value = name;
  document.getElementById('f-brand').value = brand;
  document.getElementById('f-color').value = color;
  document.getElementById('f-year').value = year;
  document.getElementById('f-price').value = price;
  document.getElementById('f-km').value = km;
  document.getElementById('f-status').value = statusText;

  selectedFiles = [];
  refreshPhotoGrid();

  document.getElementById('modalTitle').textContent = 'Edit Bike';
  document.getElementById('saveBtn').textContent = 'Save Changes';
  document.getElementById('bikeModal').classList.add('open');
}

function closeModal() {
  document.getElementById('bikeModal').classList.remove('open');
  selectedFiles = [];
  clearForm();
}

function clearForm() {
  ['f-name','f-brand','f-year','f-price','f-km','f-color','f-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-owner').value = '1st Owner';
  document.getElementById('f-fuel').value = 'Petrol';
  document.getElementById('f-status').value = 'active';
  refreshPhotoGrid();
}

// ── Photo upload ─────────────────────────────────────────
function handleFiles(files) {
  const allowed = ['image/jpeg','image/png','image/webp'];
  Array.from(files).forEach(f => {
    if (!allowed.includes(f.type)) return;
    if (f.size > 10 * 1024 * 1024) { alert(`${f.name} exceeds 10MB limit.`); return; }
    selectedFiles.push(f);
  });
  refreshPhotoGrid();
  // clear input so same file can be re-added after removal
  document.getElementById('photoInput').value = '';
}

function refreshPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  const prompt = document.getElementById('uploadPrompt');

  if (selectedFiles.length === 0) {
    prompt.style.display = 'flex';
    grid.innerHTML = '';
    return;
  }
  prompt.style.display = 'none';
  grid.innerHTML = '';

  selectedFiles.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'preview-item' + (i === 0 ? ' cover' : '');
    item.innerHTML = `
      <img src="${url}" alt="${file.name}"/>
      <button class="rm-photo" title="Remove" onclick="removePhoto(${i},event)">×</button>
    `;
    grid.appendChild(item);
  });
}

function removePhoto(idx, e) {
  e.stopPropagation();
  selectedFiles.splice(idx, 1);
  refreshPhotoGrid();
}

function dragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('drag-over');
}

function dropFiles(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
}

// ── Save bike ────────────────────────────────────────────
function saveBike() {
  const name = document.getElementById('f-name').value.trim();
  const brand = document.getElementById('f-brand').value.trim();
  const year = document.getElementById('f-year').value.trim();
  const price = document.getElementById('f-price').value.trim();
  const km = document.getElementById('f-km').value.trim();
  const color = document.getElementById('f-color').value.trim();
  const status = document.getElementById('f-status').value;

  if (!name || !brand || !year || !price) {
    alert('Please fill in Bike Name, Brand, Year and Price.');
    return;
  }

  if (editingRow) {
    // Update existing row
    editingRow.querySelector('.bike-name').textContent = name;
    editingRow.querySelector('.bike-brand').textContent = `${brand}${color ? ' · ' + color : ''}`;
    editingRow.cells[1].textContent = year;
    editingRow.cells[2].innerHTML = `<span class="price-cell">₹${price}</span>`;
    editingRow.cells[3].textContent = km ? `${km} km` : '—';
    const badge = editingRow.querySelector('.badge');
    if (badge) {
      badge.textContent = status === 'active' ? 'Active' : 'Sold';
      badge.className = `badge ${status}`;
    }
    // Update image if photos uploaded
    if (selectedFiles.length > 0) {
      const url = URL.createObjectURL(selectedFiles[0]);
      const img = editingRow.querySelector('.bike-thumb img');
      if (img) img.src = url;
    }
    editingRow.dataset.status = status;
    editingRow.dataset.name = name;
  } else {
    // Insert new row
    const imgSrc = selectedFiles.length > 0
      ? URL.createObjectURL(selectedFiles[0])
      : 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&q=70';

    const tbody = document.getElementById('inventoryBody');
    const tr = document.createElement('tr');
    tr.dataset.name = name;
    tr.dataset.status = status;
    tr.innerHTML = `
      <td>
        <div class="bike-cell">
          <div class="bike-thumb"><img src="${imgSrc}" alt=""/></div>
          <div>
            <p class="bike-name">${escHtml(name)}</p>
            <p class="bike-brand">${escHtml(brand)}${color ? ' · ' + escHtml(color) : ''}</p>
          </div>
        </div>
      </td>
      <td>${escHtml(year)}</td>
      <td class="price-cell">₹${escHtml(price)}</td>
      <td>${km ? escHtml(km) + ' km' : '—'}</td>
      <td><span class="badge ${status}">${status === 'active' ? 'Active' : 'Sold'}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="openEditBike(this)">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" title="Delete" onclick="deleteBike(this)">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.prepend(tr);
  }

  closeModal();
}

function deleteBike(btn) {
  const row = btn.closest('tr');
  const name = row.querySelector('.bike-name')?.textContent || 'this bike';
  if (confirm(`Remove "${name}" from inventory?`)) {
    row.style.transition = 'opacity 0.2s';
    row.style.opacity = '0';
    setTimeout(() => row.remove(), 200);
  }
}

// ── Table search/filter ──────────────────────────────────
function filterBikes() {
  const query = document.getElementById('bikeSearch').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  document.querySelectorAll('#inventoryBody tr').forEach(row => {
    const nameMatch = row.dataset.name.toLowerCase().includes(query);
    const statusMatch = !status || row.dataset.status === status;
    row.style.display = (nameMatch && statusMatch) ? '' : 'none';
  });
}

// ── Enquiries ────────────────────────────────────────────
function markRead(btn) {
  const item = btn.closest('.enq-item');
  item.classList.remove('unread');
  const badge = item.querySelector('.badge.new');
  if (badge) { badge.className = 'badge reviewed sm'; badge.textContent = 'Read'; }
  btn.remove();
  updateUnreadCount();
}

function updateUnreadCount() {
  const count = document.querySelectorAll('.enq-item.unread').length;
  const el = document.getElementById('unreadBadge');
  if (el) el.textContent = count > 0 ? `${count} Unread` : 'All Read';
  // sidebar badge
  const sb = document.querySelector('.sb-badge');
  if (sb) { sb.textContent = count; sb.style.display = count > 0 ? '' : 'none'; }
}

function replyEnquiry(name) {
  alert(`Opening reply to ${name}…\n(Connect to your email/WhatsApp integration here.)`);
}

// ── Sell Requests ────────────────────────────────────────
const SELL_DATA = [
  { seller:'Rahul M.', bike:'Honda CB300R', year:'2023', km:'6,200', price:'₹2,40,000', date:'13 Jun 2026', status:'New', phone:'+91 98765 00001', condition:'Good',
    photos:[
      'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=300&q=70',
      'https://images.unsplash.com/photo-1517994112540-009c47ea476b?w=300&q=70',
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=300&q=70'
    ] },
  { seller:'Arjun P.', bike:'Bajaj Dominar 400', year:'2022', km:'22,000', price:'₹1,80,000', date:'12 Jun 2026', status:'New', phone:'+91 98765 00002', condition:'Fair',
    photos:[
      'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=300&q=70',
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=300&q=70'
    ] },
  { seller:'Sneha Raj', bike:'Yamaha R15 V4', year:'2023', km:'5,200', price:'₹1,45,000', date:'12 Jun 2026', status:'Accepted', phone:'+91 98765 00003', condition:'Excellent',
    photos:[
      'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=300&q=70',
      'https://images.unsplash.com/photo-1571805423144-2e0e7f8e5a63?w=300&q=70',
      'https://images.unsplash.com/photo-1599819177362-e98a0b95acb1?w=300&q=70',
      'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=300&q=70'
    ] },
];

function viewSellRequest(btn) {
  const row = btn.closest('tr');
  const idx = Array.from(row.parentElement.children).indexOf(row);
  const d = SELL_DATA[idx];
  if (!d) return;

  const photosHtml = (d.photos && d.photos.length)
    ? `
      <div class="modal-section-label">Uploaded Photos <span class="label-hint">(${d.photos.length} photo${d.photos.length > 1 ? 's' : ''})</span></div>
      <div class="sell-photo-grid">
        ${d.photos.map(src => `
          <a class="sell-photo" href="${src.replace('w=300', 'w=1200')}" target="_blank" title="View full size">
            <img src="${src}" alt="${d.bike} photo"/>
          </a>
        `).join('')}
      </div>
    `
    : `<div class="modal-section-label">Uploaded Photos</div><p style="font-size:13px;color:var(--ink-3);margin-bottom:20px;">No photos were uploaded with this request.</p>`;

  document.getElementById('sellModalBody').innerHTML = `
    ${photosHtml}
    <div class="modal-section-label" style="margin-top:4px;">Request Details</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="sf-field"><label>Seller</label><input type="text" value="${d.seller}" readonly/></div>
      <div class="sf-field"><label>Phone</label><input type="text" value="${d.phone}" readonly/></div>
      <div class="sf-field"><label>Bike</label><input type="text" value="${d.bike}" readonly/></div>
      <div class="sf-field"><label>Year</label><input type="text" value="${d.year}" readonly/></div>
      <div class="sf-field"><label>Km Driven</label><input type="text" value="${d.km} km" readonly/></div>
      <div class="sf-field"><label>Asking Price</label><input type="text" value="${d.price}" readonly/></div>
      <div class="sf-field"><label>Condition</label><input type="text" value="${d.condition}" readonly/></div>
      <div class="sf-field"><label>Date</label><input type="text" value="${d.date}" readonly/></div>
    </div>
  `;
  document.getElementById('sellModal').classList.add('open');
}

// ── Utility ──────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close modals on bg click
document.getElementById('bikeModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('sellModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});