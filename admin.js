// ── Auth guard using Supabase session ────────────────────
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'admin-login.html';
  } else {
    // Set email in Settings tab admin email input
    const emailInput = document.getElementById('s-adminemail');
    if (emailInput) emailInput.value = session.user.email || '';
    
    // Load initial dashboard statistics and items
    loadDashboardData();
  }
}

// Global dataset references
let ALL_BIKES = [];
let SELL_DATA = [];
let ENQUIRY_DATA = [];
let editingRow = null;
let selectedFiles = [];

// Initialize Auth
checkAuth();

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

async function markAllNotifsRead() {
  const unreadIds = ENQUIRY_DATA.filter(e => !e.is_read).map(e => e.id);
  if (unreadIds.length > 0) {
    const { error } = await supabase.from('enquiries').update({ is_read: true }).in('id', unreadIds);
    if (error) {
      console.error(error);
      return;
    }
  }
  document.querySelectorAll('#notifList .notif-item.unread').forEach(item => {
    item.classList.remove('unread');
  });
  const dot = document.getElementById('notifDot');
  if (dot) dot.classList.add('hidden');
  await loadEnquiries();
  updateKPIs();
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('notifWrap');
  const dropdown = document.getElementById('notifDropdown');
  if (!wrap || !dropdown) return;
  if (!wrap.contains(e.target)) dropdown.classList.remove('open');
});

// ── Logout ───────────────────────────────────────────────
async function logout() {
  if (confirm('Sign out of KL7 Garage admin?')) {
    await supabase.auth.signOut();
    window.location.href = 'admin-login.html';
  }
}

// ── Dashboard Data Load ──────────────────────────────────
async function loadDashboardData() {
  await Promise.all([
    loadBikes(),
    loadSellRequests(),
    loadEnquiries(),
    loadSettings()
  ]);
  updateKPIs();
}

// ── KPI Statistics & Overview ────────────────────────────
function updateKPIs() {
  const bikesCount = ALL_BIKES.length;
  const sellCount = SELL_DATA.length;
  const enqCount = ENQUIRY_DATA.length;
  const unreadEnqCount = ENQUIRY_DATA.filter(e => !e.is_read).length;
  const newSellRequestsCount = SELL_DATA.filter(s => s.status === 'new').length;
  const activeBikesCount = ALL_BIKES.filter(b => b.status === 'active').length;

  if (document.getElementById('kpiBikes')) document.getElementById('kpiBikes').textContent = bikesCount;
  if (document.getElementById('kpiBikesDelta')) document.getElementById('kpiBikesDelta').textContent = `${activeBikesCount} Active`;

  if (document.getElementById('kpiSell')) document.getElementById('kpiSell').textContent = sellCount;
  if (document.getElementById('kpiSellDelta')) document.getElementById('kpiSellDelta').textContent = `${newSellRequestsCount} New`;

  if (document.getElementById('kpiEnquiries')) document.getElementById('kpiEnquiries').textContent = enqCount;
  if (document.getElementById('kpiEnquiriesDelta')) document.getElementById('kpiEnquiriesDelta').textContent = `${unreadEnqCount} Unread`;

  renderActivityFeed();
}

function renderActivityFeed() {
  const container = document.querySelector('.activity-feed');
  if (!container) return;
  container.innerHTML = '';

  const activities = [];

  ALL_BIKES.forEach(b => {
    activities.push({
      type: 'bike',
      title: `Bike listed — ${b.name} added to inventory`,
      time: new Date(b.created_at),
      color: 'amber'
    });
  });

  SELL_DATA.forEach(s => {
    activities.push({
      type: 'sell',
      title: `New sell request — ${s.seller_name} submitted ${s.brand} ${s.model} details`,
      time: new Date(s.created_at),
      color: 'green'
    });
  });

  ENQUIRY_DATA.forEach(e => {
    const subj = e.bikes ? `about ${e.bikes.name}` : 'via general form';
    activities.push({
      type: 'enquiry',
      title: `Enquiry received — ${e.full_name} contacted ${subj}`,
      time: new Date(e.created_at),
      color: 'blue'
    });
  });

  activities.sort((a, b) => b.time - a.time);
  const recent = activities.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--ink-3); font-size: 13.5px;">No recent activity.</div>';
    return;
  }

  recent.forEach(act => {
    const timeStr = formatTimeAgo(act.time);
    const item = document.createElement('div');
    item.className = 'af-item';
    item.innerHTML = `
      <div class="af-dot ${act.color}"></div>
      <div class="af-body">
        <p>${act.title}</p>
        <time>${timeStr}</time>
      </div>
    `;
    container.appendChild(item);
  });
}

// ── Settings ─────────────────────────────────────────────
async function loadSettings() {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
  if (data) {
    if (document.getElementById('s-bizname')) document.getElementById('s-bizname').value = data.business_name || '';
    if (document.getElementById('s-bizphone')) document.getElementById('s-bizphone').value = data.phone || '';
    if (document.getElementById('s-bizinsta')) document.getElementById('s-bizinsta').value = data.instagram_handle || '';
    if (document.getElementById('s-bizaddress')) document.getElementById('s-bizaddress').value = data.address || '';
  }
}

async function saveSettings() {
  const business_name = document.getElementById('s-bizname').value.trim();
  const phone = document.getElementById('s-bizphone').value.trim();
  const instagram_handle = document.getElementById('s-bizinsta').value.trim();
  const address = document.getElementById('s-bizaddress').value.trim();

  const { error } = await supabase.from('site_settings').update({
    business_name,
    phone,
    instagram_handle,
    address
  }).eq('id', 1);

  if (error) {
    console.error(error);
    alert('Failed to save settings.');
  } else {
    alert('Settings saved successfully!');
  }
}

async function updateCredentials() {
  const email = document.getElementById('s-adminemail').value.trim();
  const password = document.getElementById('s-adminpass').value;
  const confirmPass = document.getElementById('s-adminpassconfirm').value;

  const updates = {};
  if (email) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user.email !== email) {
      updates.email = email;
    }
  }

  if (password) {
    if (password !== confirmPass) {
      alert('Passwords do not match.');
      return;
    }
    updates.password = password;
  }

  if (Object.keys(updates).length === 0) {
    alert('No updates provided.');
    return;
  }

  const { error } = await supabase.auth.updateUser(updates);
  if (error) {
    console.error(error);
    alert('Failed to update credentials: ' + error.message);
  } else {
    alert('Credentials updated successfully!' + (updates.email ? ' Please check your email to confirm the change.' : ''));
    document.getElementById('s-adminpass').value = '';
    document.getElementById('s-adminpassconfirm').value = '';
  }
}

// ── Bikes (Inventory) CRUD ────────────────────────────────
async function loadBikes() {
  const { data, error } = await supabase
    .from('bikes')
    .select('*, bike_photos(*)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  ALL_BIKES = data;
  renderBikesTable();
}

function renderBikesTable() {
  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  ALL_BIKES.forEach(b => {
    const cover = b.cover_image || (b.bike_photos?.[0]?.image_url) || 'assets/placeholder.png';
    const segmentBadge = b.is_luxury ? '<span class="badge luxury" style="margin-left:6px;">Luxury</span>' : '';
    const tr = document.createElement('tr');
    tr.dataset.id = b.id;
    tr.dataset.name = b.name;
    tr.dataset.status = b.status;
    tr.innerHTML = `
      <td>
        <div class="bike-cell">
          <div class="bike-thumb"><img src="${cover}" alt=""/></div>
          <div>
            <p class="bike-name">${escHtml(b.name)}</p>
            <p class="bike-brand">${escHtml(b.brand)}${b.color ? ' · ' + escHtml(b.color) : ''}</p>
          </div>
        </div>
      </td>
      <td>${escHtml(b.year)}</td>
      <td class="price-cell">₹${b.price.toLocaleString('en-IN')}</td>
      <td>${b.km_driven ? escHtml(Number(b.km_driven).toLocaleString()) + ' km' : '—'}</td>
      <td><span class="badge ${b.status}">${b.status === 'active' ? 'Active' : 'Sold'}</span>${segmentBadge}</td>
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
    tbody.appendChild(tr);
  });
}

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
  const id = row.dataset.id;
  editingRow = row;

  const bike = ALL_BIKES.find(b => b.id === id);
  if (!bike) return;

  document.getElementById('f-name').value = bike.name;
  document.getElementById('f-brand').value = bike.brand;
  document.getElementById('f-color').value = bike.color || '';
  document.getElementById('f-year').value = bike.year;
  document.getElementById('f-price').value = bike.price;
  document.getElementById('f-km').value = bike.km_driven;
  document.getElementById('f-status').value = bike.status;
  document.getElementById('f-owner').value = bike.ownership || '1st Owner';
  document.getElementById('f-fuel').value = bike.fuel_type || 'Petrol';
  document.getElementById('f-desc').value = bike.description || '';
  document.getElementById('f-luxury').value = bike.is_luxury ? 'true' : 'false';

  selectedFiles = [];
  refreshPhotoGrid(bike.bike_photos || []);

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
  ['f-name', 'f-brand', 'f-year', 'f-price', 'f-km', 'f-color', 'f-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-owner').value = '1st Owner';
  document.getElementById('f-fuel').value = 'Petrol';
  document.getElementById('f-status').value = 'active';
  document.getElementById('f-luxury').value = 'false';
  refreshPhotoGrid();
}

// ── Photo upload handling ────────────────────────────────
function handleFiles(files) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  Array.from(files).forEach(f => {
    if (!allowed.includes(f.type)) return;
    if (f.size > 10 * 1024 * 1024) { alert(`${f.name} exceeds 10MB limit.`); return; }
    selectedFiles.push(f);
  });
  
  let currentExisting = [];
  if (editingRow) {
    const bike = ALL_BIKES.find(b => b.id === editingRow.dataset.id);
    if (bike) currentExisting = bike.bike_photos || [];
  }
  refreshPhotoGrid(currentExisting);
  document.getElementById('photoInput').value = '';
}

function refreshPhotoGrid(existingPhotos = []) {
  const grid = document.getElementById('photoGrid');
  const prompt = document.getElementById('uploadPrompt');

  if (selectedFiles.length === 0 && existingPhotos.length === 0) {
    prompt.style.display = 'flex';
    grid.innerHTML = '';
    return;
  }
  prompt.style.display = 'none';
  grid.innerHTML = '';

  existingPhotos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'preview-item' + (i === 0 ? ' cover' : '');
    item.innerHTML = `
      <img src="${p.image_url}" alt="Existing Photo"/>
      <button class="rm-photo" type="button" title="Delete from Database" onclick="deleteExistingPhoto('${p.id}', '${p.bike_id}', event)">×</button>
    `;
    grid.appendChild(item);
  });

  selectedFiles.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'preview-item' + ((existingPhotos.length + i) === 0 ? ' cover' : '');
    item.innerHTML = `
      <img src="${url}" alt="${file.name}"/>
      <button class="rm-photo" type="button" title="Remove" onclick="removePhoto(${i}, event)">×</button>
    `;
    grid.appendChild(item);
  });
}

function removePhoto(idx, e) {
  e.stopPropagation();
  selectedFiles.splice(idx, 1);
  let currentExisting = [];
  if (editingRow) {
    const bike = ALL_BIKES.find(b => b.id === editingRow.dataset.id);
    if (bike) currentExisting = bike.bike_photos || [];
  }
  refreshPhotoGrid(currentExisting);
}

async function deleteExistingPhoto(photoId, bikeId, e) {
  e.stopPropagation();
  if (confirm('Delete this photo permanently from the database?')) {
    const { error } = await supabase.from('bike_photos').delete().eq('id', photoId);
    if (error) {
      console.error(error);
      alert('Failed to delete photo.');
      return;
    }
    const bikeIdx = ALL_BIKES.findIndex(b => b.id === bikeId);
    if (bikeIdx !== -1) {
      const { data: updatedPhotos } = await supabase
        .from('bike_photos')
        .select('*')
        .eq('bike_id', bikeId)
        .order('sort_order', { ascending: true });
      ALL_BIKES[bikeIdx].bike_photos = updatedPhotos;
      
      const nextCover = updatedPhotos?.[0]?.image_url || null;
      if (ALL_BIKES[bikeIdx].cover_image !== nextCover) {
        await supabase.from('bikes').update({ cover_image: nextCover }).eq('id', bikeId);
        ALL_BIKES[bikeIdx].cover_image = nextCover;
      }
      refreshPhotoGrid(updatedPhotos);
      renderBikesTable();
    }
  }
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

// ── Save BikeCRUD updates ────────────────────────────────
async function saveBike() {
  const name = document.getElementById('f-name').value.trim();
  const brand = document.getElementById('f-brand').value.trim();
  const year = Number(document.getElementById('f-year').value.trim());
  const price = Number(document.getElementById('f-price').value.replace(/,/g, '').trim());
  const km = Number(document.getElementById('f-km').value.replace(/,/g, '').trim()) || 0;
  const color = document.getElementById('f-color').value.trim();
  const status = document.getElementById('f-status').value;
  const ownership = document.getElementById('f-owner').value;
  const fuel_type = document.getElementById('f-fuel').value;
  const description = document.getElementById('f-desc').value.trim();
  const is_luxury = document.getElementById('f-luxury').value === 'true';

  if (!name || !brand || !year || !price) {
    alert('Please fill in Bike Name, Brand, Year and Price.');
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  const origText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  let bikeId;
  if (editingRow) {
    bikeId = editingRow.dataset.id;
    const { error } = await supabase.from('bikes').update({
      name, brand, year, price, km_driven: km, color, status, ownership, fuel_type, description, is_luxury
    }).eq('id', bikeId);
    if (error) {
      console.error(error);
      alert('Failed to update bike.');
      saveBtn.disabled = false;
      saveBtn.textContent = origText;
      return;
    }
  } else {
    const { data, error } = await supabase.from('bikes').insert({
      name, brand, year, price, km_driven: km, color, status, ownership, fuel_type, description, is_luxury
    }).select().single();
    if (error) {
      console.error(error);
      alert('Failed to insert bike.');
      saveBtn.disabled = false;
      saveBtn.textContent = origText;
      return;
    }
    bikeId = data.id;
  }

  // Upload new photos
  if (selectedFiles.length > 0) {
    let currentPhotosCount = 0;
    if (editingRow) {
      const currentBike = ALL_BIKES.find(b => b.id === bikeId);
      currentPhotosCount = currentBike?.bike_photos?.length || 0;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const path = `bikes/${bikeId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('bike-photos').upload(path, file);
      if (!uploadError) {
        const { data: pub } = supabase.storage.from('bike-photos').getPublicUrl(path);
        await supabase.from('bike_photos').insert({
          bike_id: bikeId,
          image_url: pub.publicUrl,
          sort_order: currentPhotosCount + i
        });
      }
    }

    // Update cover image to the first photo's URL
    const { data: finalPhotos } = await supabase
      .from('bike_photos')
      .select('image_url')
      .eq('bike_id', bikeId)
      .order('sort_order', { ascending: true });
    if (finalPhotos && finalPhotos.length > 0) {
      await supabase.from('bikes').update({ cover_image: finalPhotos[0].image_url }).eq('id', bikeId);
    }
  }

  await loadBikes();
  updateKPIs();
  closeModal();
  saveBtn.disabled = false;
  saveBtn.textContent = origText;
}

async function deleteBike(btn) {
  const row = btn.closest('tr');
  const id = row.dataset.id;
  const name = row.querySelector('.bike-name')?.textContent || 'this bike';
  if (confirm(`Remove "${name}" from inventory?`)) {
    const { error } = await supabase.from('bikes').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert('Failed to delete bike.');
      return;
    }
    row.style.transition = 'opacity 0.2s';
    row.style.opacity = '0';
    setTimeout(async () => {
      row.remove();
      await loadBikes();
      updateKPIs();
    }, 200);
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

// ── Sell Requests ────────────────────────────────────────
async function loadSellRequests() {
  const { data, error } = await supabase
    .from('sell_requests')
    .select('*, sell_request_photos(*)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  SELL_DATA = data;
  renderSellRequestsTable();
}

function renderSellRequestsTable() {
  const tbody = document.querySelector('#tab-sell-requests tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  SELL_DATA.forEach(d => {
    const avatarChar = d.seller_name ? d.seller_name.charAt(0).toUpperCase() : 'S';
    const formattedDate = new Date(d.created_at).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const tr = document.createElement('tr');
    tr.dataset.id = d.id;
    tr.innerHTML = `
      <td><div class="person-cell"><div class="avatar-xs">${avatarChar}</div>${escHtml(d.seller_name)}</div></td>
      <td>${escHtml(d.brand)} ${escHtml(d.model)}</td>
      <td>${escHtml(d.registration_year || '—')}</td>
      <td>${d.km_driven ? escHtml(Number(d.km_driven).toLocaleString()) : '0'}</td>
      <td>${d.price ? '₹' + escHtml(d.price.toLocaleString()) : '—'}</td>
      <td>${formattedDate}</td>
      <td><span class="badge ${d.status === 'new' ? 'new' : 'active'}">${escHtml(d.status.toUpperCase())}</span></td>
      <td><button class="btn-sm" onclick="viewSellRequest(this)">View</button></td>
    `;
    tbody.appendChild(tr);
  });
}

let currentSellRequestId = null;

function viewSellRequest(btn) {
  const row = btn.closest('tr');
  const id = row.dataset.id;
  currentSellRequestId = id;
  const d = SELL_DATA.find(x => x.id === id);
  if (!d) return;

  const photosHtml = (d.sell_request_photos && d.sell_request_photos.length)
    ? `
      <div class="modal-section-label">Uploaded Photos <span class="label-hint">(${d.sell_request_photos.length} photo${d.sell_request_photos.length > 1 ? 's' : ''})</span></div>
      <div class="sell-photo-grid">
        ${d.sell_request_photos.map(p => `
          <a class="sell-photo" href="${p.image_url}" target="_blank" title="View full size">
            <img src="${p.image_url}" alt="${d.brand} photo"/>
          </a>
        `).join('')}
      </div>
    `
    : `<div class="modal-section-label">Uploaded Photos</div><p style="font-size:13px;color:var(--ink-3);margin-bottom:20px;">No photos were uploaded with this request.</p>`;

  const formattedDate = new Date(d.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  document.getElementById('sellModalBody').innerHTML = `
    ${photosHtml}
    <div class="modal-section-label" style="margin-top:4px;">Request Details</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="sf-field"><label>Seller</label><input type="text" value="${d.seller_name}" readonly/></div>
      <div class="sf-field"><label>Phone</label><input type="text" value="${d.phone}" readonly/></div>
      <div class="sf-field"><label>Email</label><input type="text" value="${d.email}" readonly/></div>
      <div class="sf-field"><label>Bike Brand & Model</label><input type="text" value="${d.brand} ${d.model}" readonly/></div>
      <div class="sf-field"><label>Registration Year</label><input type="text" value="${d.registration_year || '—'}" readonly/></div>
      <div class="sf-field"><label>Km Driven</label><input type="text" value="${d.km_driven ? Number(d.km_driven).toLocaleString() + ' km' : '—'}" readonly/></div>
      <div class="sf-field"><label>Condition</label><input type="text" value="${d.condition || '—'}" readonly/></div>
      <div class="sf-field"><label>Insurance Status</label><input type="text" value="${d.insurance_status || '—'}" readonly/></div>
      <div class="sf-field"><label>Location</label><input type="text" value="${d.location || '—'}" readonly/></div>
      <div class="sf-field"><label>Date Received</label><input type="text" value="${formattedDate}" readonly/></div>
    </div>
  `;

  const acceptBtn = document.getElementById('btnAcceptSell');
  if (acceptBtn) {
    if (d.status === 'accepted') {
      acceptBtn.textContent = 'Accepted';
      acceptBtn.disabled = true;
    } else {
      acceptBtn.textContent = 'Accept & Contact';
      acceptBtn.disabled = false;
    }
  }

  document.getElementById('sellModal').classList.add('open');
}

async function acceptSellRequest() {
  if (!currentSellRequestId) return;
  const { error } = await supabase
    .from('sell_requests')
    .update({ status: 'accepted' })
    .eq('id', currentSellRequestId);
  
  if (error) {
    console.error(error);
    alert('Failed to accept request.');
    return;
  }
  
  alert('Request marked as accepted!');
  document.getElementById('sellModal').classList.remove('open');
  await loadSellRequests();
  updateKPIs();
}

// ── Enquiries ────────────────────────────────────────────
async function loadEnquiries() {
  const { data, error } = await supabase
    .from('enquiries')
    .select('*, bikes(name)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  ENQUIRY_DATA = data;
  renderEnquiriesList();
  renderNotificationsDropdown();
}

function renderEnquiriesList() {
  const list = document.getElementById('enquiryList');
  if (!list) return;
  list.innerHTML = '';
  
  ENQUIRY_DATA.forEach(d => {
    const avatarChar = d.full_name ? d.full_name.charAt(0).toUpperCase() : 'E';
    const timeStr = formatTimeAgo(new Date(d.created_at));
    const statusBadge = d.is_read
      ? '<span class="badge reviewed sm">Read</span>'
      : '<span class="badge new sm">Unread</span>';
    
    const subject = d.bikes ? `Re: ${d.bikes.name}` : 'General Contact Form';
    
    const item = document.createElement('div');
    item.className = 'enq-item' + (d.is_read ? '' : ' unread');
    item.dataset.id = d.id;
    item.innerHTML = `
      <div class="enq-row">
        <div class="avatar-sm">${avatarChar}</div>
        <div class="enq-meta">
          <div class="enq-top">
            <strong>${escHtml(d.full_name)}</strong>
            <time>${timeStr}</time>
            ${statusBadge}
          </div>
          <p class="enq-subject">${escHtml(subject)}</p>
        </div>
      </div>
      <p class="enq-preview">${escHtml(d.message)}</p>
      <div style="font-size:12.5px; color:var(--ink-3); padding-left:46px; margin-bottom:8px;">
        <span>Email: ${escHtml(d.email || '—')}</span> &bull; <span>Phone: ${escHtml(d.phone || '—')}</span>
      </div>
      <div class="enq-actions">
        ${!d.is_read ? `<button class="btn-sm" onclick="markRead('${d.id}', this)">Mark as Read</button>` : ''}
        <button class="btn-sm btn-sm-dark" onclick="replyEnquiry('${escHtml(d.full_name)}', '${escHtml(d.email)}', '${escHtml(d.phone)}')">Reply</button>
      </div>
    `;
    list.appendChild(item);
  });

  updateUnreadCount();
}

function renderNotificationsDropdown() {
  const list = document.getElementById('notifList');
  if (!list) return;
  list.innerHTML = '';
  
  const unreadEnquiries = ENQUIRY_DATA.filter(e => !e.is_read);
  const recentUnread = unreadEnquiries.slice(0, 5);

  if (recentUnread.length === 0) {
    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--ink-3); font-size:13px;">No unread notifications.</div>';
    const dot = document.getElementById('notifDot');
    if (dot) dot.classList.add('hidden');
    return;
  }

  const dot = document.getElementById('notifDot');
  if (dot) {
    dot.classList.remove('hidden');
    dot.textContent = unreadEnquiries.length;
  }

  recentUnread.forEach(d => {
    const timeStr = formatTimeAgo(new Date(d.created_at));
    const subject = d.bikes ? `about ${d.bikes.name}` : 'general inquiry';
    const item = document.createElement('div');
    item.className = 'notif-item unread';
    item.innerHTML = `
      <div class="notif-icon blue">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      </div>
      <div class="notif-body">
        <p><strong>New enquiry</strong> from ${escHtml(d.full_name)} ${escHtml(subject)}</p>
        <time>${timeStr}</time>
      </div>
    `;
    list.appendChild(item);
  });
}

async function markRead(enquiryId, btn) {
  const { error } = await supabase.from('enquiries').update({ is_read: true }).eq('id', enquiryId);
  if (error) {
    console.error(error);
    alert('Failed to mark as read.');
    return;
  }
  
  const item = btn.closest('.enq-item');
  if (item) {
    item.classList.remove('unread');
    const badge = item.querySelector('.badge.new');
    if (badge) {
      badge.className = 'badge reviewed sm';
      badge.textContent = 'Read';
    }
  }
  btn.remove();
  await loadEnquiries();
  updateKPIs();
}

function updateUnreadCount() {
  const count = ENQUIRY_DATA.filter(e => !e.is_read).length;
  const el = document.getElementById('unreadBadge');
  if (el) el.textContent = count > 0 ? `${count} Unread` : 'All Read';
  
  const sb = document.querySelector('.sb-badge');
  if (sb) {
    sb.textContent = count;
    sb.style.display = count > 0 ? '' : 'none';
  }
}

function replyEnquiry(name, email, phone) {
  if (email) {
    window.location.href = `mailto:${email}?subject=KL7 Garage Inquiry Response`;
  } else if (phone) {
    window.location.href = `tel:${phone}`;
  } else {
    alert(`No contact info for ${name}.`);
  }
}

// ── Utility Functions ────────────────────────────────────
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + "y ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + "mo ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + "d ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";
  return "just now";
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Close modals on background click
document.getElementById('bikeModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('sellModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});