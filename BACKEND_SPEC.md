# KL7 Garage — Backend Development Spec (Supabase)

> **Audience:** Antigravity (AI dev agent)
> **Goal:** Wire a real backend (Supabase) to the existing static frontend at `github.com/collabstudioin-ui/KL7_GARAGE`.
> **Hard rule:** Do **not** change any existing HTML structure, CSS, class names, or visual design. Only add `<script>` logic, new `data-*` attributes, new IDs where required for hooks, and net-new markup pieces explicitly called out below (e.g. the luxury badge). Every fix must preserve current look and feel pixel-for-pixel.

---

## 1. Current State Audit (what is broken / fake today)

| Area | File(s) | Current behavior | Problem |
|---|---|---|---|
| Bikes grid | `bikes.html` | 9 bikes hardcoded in HTML, images from Unsplash | No real data, can't add/remove bikes without editing HTML |
| Search box | `bikes.html` (`filterBikes()`) | Filters by title text only | Works, but only one filter of many |
| Brand checkboxes | `bikes.html` sidebar | Render only, no `onchange`/JS | **Non-functional** |
| Price range slider | `bikes.html` sidebar | Render only, no JS listener | **Non-functional** |
| Year range slider | `bikes.html` sidebar | Render only, no JS listener | **Non-functional** |
| Body type checkboxes | `bikes.html` sidebar | Render only | **Non-functional** |
| Color checkboxes | `bikes.html` sidebar | Render only | **Non-functional** |
| Km driven slider | `bikes.html` sidebar | Render only | **Non-functional** |
| Apply Filters / Reset buttons | `bikes.html` sidebar | No `onclick` at all | **Non-functional** |
| Sort dropdown | `bikes.html` top bar | No `onchange` | **Non-functional** |
| Mobile filter chips (Brand/Price/Sort) | `bikes.html` | No click handler | **Non-functional** |
| Pagination buttons (1–5) | `bikes.html` | Static, no click handler | **Non-functional** |
| "VIEW DETAILS" links | `bikes.html`, `index.html` | All point to the same static `bike-details.html` (some to `#`) | No bike ID is passed, details page can't show the correct bike |
| Bike details page | `bike-details.html` | One bike's data is hardcoded directly in HTML | Needs to read an ID from the URL and fetch real data |
| Sell Your Bike form | `sell.html` | `onsubmit="return false;"` — does nothing | **No submission logic, no storage** |
| Contact form | `index.html` | `onsubmit="return false;"` — does nothing | **No submission logic, no storage** |
| Admin login | `admin-login.html` | Hardcoded `ADMIN_ID`/`ADMIN_PASS` in plain JS, flag in `sessionStorage` | Insecure, must move to real auth |
| Admin dashboard — Inventory tab | `admin-dashboard.html` + `admin.js` | Add/Edit/Delete only mutate the DOM table in memory; refresh wipes everything | **No persistence** |
| Admin photo upload | `admin.js` (`handleFiles`) | Uses `URL.createObjectURL()` — local blob URL only | Images never leave the browser, lost on refresh |
| Admin Sell Requests tab | `admin.js` (`SELL_DATA` array) | Hardcoded array in JS | Not connected to real sell submissions |
| Admin Enquiries tab | `admin-dashboard.html` | Hardcoded HTML list | Not connected to real contact-form submissions |
| Admin Gallery tab | `admin-dashboard.html` | Just a static blurb pointing to Curator.io | Out of scope — leave as-is (Instagram-driven, not DB-driven) |
| Admin Settings tab | `admin-dashboard.html` | "Save Changes" / "Update Credentials" buttons have no `onclick` | **Non-functional**, needs wiring |
| Luxury vs Normal segment | *(does not exist anywhere)* | No tag, no differentiated card style | **New feature to build from scratch** |

---

## 2. Supabase Project Setup

1. Create a Supabase project. Capture `Project URL` and `anon public key`.
2. Add the Supabase JS client to every page that needs it (CDN, no build step, keeps the "don't change design" constraint trivial since this is just an added `<script>` tag):
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
   <script>
     const supabase = window.supabase.createClient(
       'https://YOUR-PROJECT.supabase.co',
       'YOUR-ANON-PUBLIC-KEY'
     );
   </script>
   ```
3. Create a Storage bucket named `bike-photos` (public read). Admin uploads write here; public pages read the returned public URL.
4. Enable Email/Password auth (or "Magic Link") in Supabase Auth — used only for the one admin account, not customers.

---

## 3. Database Schema

```sql
-- ════════════════════════════════════════════
-- BIKES (inventory)
-- ════════════════════════════════════════════
create table bikes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- "Royal Enfield Shotgun 650"
  brand         text not null,                  -- "Royal Enfield" (used by Brand filter)
  year          int  not null,
  price         numeric not null,               -- store as plain number (413042), format with ₹ + commas in frontend
  km_driven     numeric default 0,
  color         text,
  body_type     text,                           -- "Cruiser" | "Sports" | "Adventure" | "Naked" | "Scooter" (Body Type filter)
  ownership     text default '1st Owner',       -- "1st Owner" | "2nd Owner" | "3rd+ Owner"
  fuel_type     text default 'Petrol',           -- "Petrol" | "Electric"
  description   text,
  status        text default 'active',          -- "active" | "sold"
  is_luxury     boolean not null default false,  -- THE LUXURY TAG. false = normal (default), true = luxury segment
  cover_image   text,                            -- public URL of first/cover photo
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ════════════════════════════════════════════
-- BIKE PHOTOS (one bike → many photos, supports admin multi-upload)
-- ════════════════════════════════════════════
create table bike_photos (
  id         uuid primary key default gen_random_uuid(),
  bike_id    uuid references bikes(id) on delete cascade,
  image_url  text not null,
  sort_order int default 0,                     -- 0 = cover/first image
  created_at timestamptz default now()
);

-- ════════════════════════════════════════════
-- SELL REQUESTS (sell.html submissions)
-- ════════════════════════════════════════════
create table sell_requests (
  id               uuid primary key default gen_random_uuid(),
  brand            text not null,
  model            text not null,
  registration_year text,
  km_driven        numeric,
  ownership        text,
  insurance_status text,                          -- "Active" | "Expired"
  condition        text,                           -- "Excellent" | "Good" | "Fair"
  seller_name      text not null,
  phone            text not null,
  location         text,
  email            text not null,
  status           text default 'new',             -- "new" | "accepted" | "rejected"
  created_at       timestamptz default now()
);

create table sell_request_photos (
  id               uuid primary key default gen_random_uuid(),
  sell_request_id  uuid references sell_requests(id) on delete cascade,
  image_url        text not null
);

-- ════════════════════════════════════════════
-- ENQUIRIES (index.html contact form + "Contact to Buy Now" on bike-details.html)
-- ════════════════════════════════════════════
create table enquiries (
  id          uuid primary key default gen_random_uuid(),
  bike_id     uuid references bikes(id),            -- null if from general contact form
  full_name   text not null,
  email       text,
  phone       text,
  message     text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ════════════════════════════════════════════
-- SITE SETTINGS (admin Settings tab — Business Info panel)
-- ════════════════════════════════════════════
create table site_settings (
  id               int primary key default 1,
  business_name    text default 'KL7 Garage',
  phone            text default '+91 95671 38088',
  instagram_handle text default '@k_l_7_garage',
  address          text,
  constraint single_row check (id = 1)
);
insert into site_settings (id) values (1);
```

### Row Level Security (RLS) — required, Supabase enables RLS by default
```sql
alter table bikes enable row level security;
alter table bike_photos enable row level security;
alter table sell_requests enable row level security;
alter table sell_request_photos enable row level security;
alter table enquiries enable row level security;
alter table site_settings enable row level security;

-- Public (anon) can READ bikes/photos only
create policy "public read bikes" on bikes for select using (true);
create policy "public read bike_photos" on bike_photos for select using (true);
create policy "public read settings" on site_settings for select using (true);

-- Public (anon) can INSERT sell requests / enquiries (write-only, no read)
create policy "public insert sell_requests" on sell_requests for insert with check (true);
create policy "public insert sell_request_photos" on sell_request_photos for insert with check (true);
create policy "public insert enquiries" on enquiries for insert with check (true);

-- Authenticated admin can do everything
create policy "admin full access bikes" on bikes for all using (auth.role() = 'authenticated');
create policy "admin full access bike_photos" on bike_photos for all using (auth.role() = 'authenticated');
create policy "admin full access sell_requests" on sell_requests for all using (auth.role() = 'authenticated');
create policy "admin full access sell_request_photos" on sell_request_photos for all using (auth.role() = 'authenticated');
create policy "admin full access enquiries" on enquiries for all using (auth.role() = 'authenticated');
create policy "admin full access settings" on site_settings for all using (auth.role() = 'authenticated');
```

---

## 4. The Luxury vs Normal Tag (core new feature)

**Field:** `bikes.is_luxury` (boolean). `false` = Normal segment (default for every new bike unless admin turns it on). `true` = Luxury segment.

**Admin side (`admin-dashboard.html` / `admin.js`):**
- Add one new control inside the existing `#bikeModal` form grid (alongside Ownership/Fuel/Status — same `.ff` markup pattern already used, so it visually matches without any new design):
  ```html
  <div class="ff">
    <label>Segment</label>
    <select id="f-luxury">
      <option value="false" selected>Normal</option>
      <option value="true">Luxury</option>
    </select>
  </div>
  ```
- `saveBike()` reads `f-luxury`, writes `is_luxury` boolean to the `bikes` row.
- In the Inventory table, add a small badge next to the existing Active/Sold `<span class="badge">` so admins can see segment at a glance, reusing the existing `.badge` CSS pattern with a new modifier class `.badge.luxury` (define this one new CSS rule — it is additive, not a redesign):
  ```css
  .badge.luxury { background:#1a1a1a; color:#d4af37; }
  ```

**Public side (`bikes.html`, `index.html` collections grid, `bike-details.html`):**
- Every bike card is rendered from JS now (see §6). When `bike.is_luxury === true`, add a `luxury` class to the existing `.bike-card-wrap`/`.bike-card` element (`class="bike-card luxury"`) — do not introduce a new card layout.
- Add one small ribbon element inside the card image container, matching the existing `.bike-card-img` wrapper pattern:
  ```html
  <div class="bike-card-img">
    <span class="luxury-tag">LUXURY</span> <!-- only rendered if is_luxury -->
    <img src="..." alt="...">
  </div>
  ```
- New CSS (additive only, append to `bikes.css` / `style.css`, do not touch existing rules):
  ```css
  .luxury-tag{
    position:absolute; top:12px; left:12px; z-index:2;
    background:linear-gradient(135deg,#d4af37,#b8860b);
    color:#0a0a0a; font-size:11px; font-weight:700;
    letter-spacing:.08em; padding:4px 10px; border-radius:4px;
    text-transform:uppercase;
  }
  .bike-card.luxury{ border:1px solid #d4af37; }
  ```
- Add a "Segment" filter to the sidebar (Luxury / Normal / All) using the same `.filter-group` / `.filter-check` markup already used for Brands — see §5.

---

## 5. Filter & Sort System — Making Every Control Work

All filtering happens **client-side in JS** against an in-memory array fetched once from Supabase (dataset is small — a few hundred bikes max — so no need for server-side filtering/pagination complexity). This keeps the existing HTML/CSS untouched; only `bikes.html`'s inline `<script>` block is replaced.

### 5.1 Data fetch on page load
```js
let ALL_BIKES = [];

async function loadBikes() {
  const { data, error } = await supabase
    .from('bikes')
    .select('*, bike_photos(image_url, sort_order)')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  ALL_BIKES = data;
  renderBikes(ALL_BIKES);
}
```

### 5.2 Wiring every existing control (add `id`s, keep all visual markup)
| Control | Add this attribute | Listener |
|---|---|---|
| Brand checkboxes | `name="brand-filter" value="Honda"` etc. | `change` → `applyFilters()` |
| Price range `<input type="range">` | `id="priceRange"` | `input` → update label + `applyFilters()` |
| Year range `<input type="range">` | `id="yearRange"` | `input` → update label + `applyFilters()` |
| Body Type checkboxes | `name="body-filter"` | `change` → `applyFilters()` |
| Color checkboxes | `name="color-filter"` | `change` → `applyFilters()` |
| Km driven range | `id="kmRange"` | `input` → update label + `applyFilters()` |
| **Segment checkboxes (new)** | `name="segment-filter" value="luxury"` / `"normal"` | `change` → `applyFilters()` |
| `.btn-apply` | — | `onclick="applyFilters()"` (mainly closes mobile drawer; filters already live-apply) |
| `.btn-reset` | — | `onclick="resetFilters()"` |
| `.sort-select` | `id="sortSelect"` | `change` → `applyFilters()` |
| Mobile filter chips | — | `onclick` opens sidebar scrolled to that filter group |
| `#bikeSearchInput` | already has `oninput` | keep, fold into `applyFilters()` |
| Pagination buttons | `onclick="goToPage(n)"` | re-render current filtered slice |

### 5.3 Core filter function (replaces the old `filterBikes()`)
```js
function applyFilters() {
  const query = document.getElementById('bikeSearchInput').value.toLowerCase();
  const brands = [...document.querySelectorAll('input[name="brand-filter"]:checked')].map(c => c.value);
  const bodyTypes = [...document.querySelectorAll('input[name="body-filter"]:checked')].map(c => c.value);
  const colors = [...document.querySelectorAll('input[name="color-filter"]:checked')].map(c => c.value);
  const segments = [...document.querySelectorAll('input[name="segment-filter"]:checked')].map(c => c.value);
  const maxPrice = Number(document.getElementById('priceRange').value);
  const maxYearVal = Number(document.getElementById('yearRange').value);
  const maxKm = Number(document.getElementById('kmRange').value);
  const sort = document.getElementById('sortSelect').value;

  let result = ALL_BIKES.filter(b =>
    b.status === 'active' &&
    b.name.toLowerCase().includes(query) &&
    (brands.length === 0 || brands.includes(b.brand)) &&
    (bodyTypes.length === 0 || bodyTypes.includes(b.body_type)) &&
    (colors.length === 0 || colors.includes(b.color)) &&
    (segments.length === 0 || segments.includes(b.is_luxury ? 'luxury' : 'normal')) &&
    b.price <= maxPrice &&
    b.year <= maxYearVal &&
    b.km_driven <= maxKm
  );

  if (sort === 'Price: Low to High') result.sort((a,b) => a.price - b.price);
  if (sort === 'Price: High to Low') result.sort((a,b) => b.price - a.price);
  if (sort === 'Newest First') result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  currentPage = 1;
  renderBikes(result);
}

function resetFilters() {
  document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
  document.getElementById('bikeSearchInput').value = '';
  document.getElementById('priceRange').value = document.getElementById('priceRange').max;
  document.getElementById('yearRange').value = document.getElementById('yearRange').max;
  document.getElementById('kmRange').value = document.getElementById('kmRange').max;
  document.getElementById('sortSelect').value = 'Relevance';
  applyFilters();
}
```

### 5.4 Render function (builds the existing card markup, including the luxury ribbon from §4, paginates client-side, updates `.bikes-count`)
```js
const PAGE_SIZE = 9;
let currentPage = 1;

function renderBikes(list) {
  document.querySelector('.bikes-count').textContent =
    `${list.length} Bike${list.length === 1 ? '' : 's'} Found`;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const grid = document.querySelector('.bikes-grid');
  grid.innerHTML = pageItems.map(b => {
    const cover = b.cover_image || (b.bike_photos?.[0]?.image_url) || 'assets/placeholder.png';
    const luxuryTag = b.is_luxury ? `<span class="luxury-tag">LUXURY</span>` : '';
    const luxuryClass = b.is_luxury ? ' luxury' : '';
    return `
      <div class="bike-card-wrap">
        <div class="bike-card${luxuryClass}">
          <div class="bike-card-img">
            ${luxuryTag}
            <img src="${cover}" alt="${b.name}"/>
          </div>
          <div class="bike-card-info">
            <h3>${b.name}</h3>
            <p class="bike-meta"><span>${b.year}</span> &bull; <span>${b.km_driven.toLocaleString()} km</span> &bull; <span>${b.color || ''}</span></p>
            <p class="bike-price">&#8377;${b.price.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <a href="bike-details.html?id=${b.id}" class="btn-view">VIEW DETAILS &#10230;</a>
      </div>`;
  }).join('');

  renderPagination(list.length);
}

function renderPagination(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const wrap = document.querySelector('.pagination');
  wrap.innerHTML = Array.from({length: totalPages}, (_, i) => `
    <button class="page-btn${i+1 === currentPage ? ' active' : ''}" onclick="goToPage(${i+1})">${i+1}</button>
  `).join('');
}

function goToPage(n) {
  currentPage = n;
  applyFilters(); // re-filters AND re-renders with new currentPage
}

document.addEventListener('DOMContentLoaded', loadBikes);
```

**Note for Antigravity:** Brand/Body Type/Color checkbox lists in the sidebar are currently hardcoded to 7 brands, 5 body types, 5 colors. Either (a) keep these hardcoded — fine since they're filter options, not data — or (b) generate them dynamically from `DISTINCT` values in `ALL_BIKES` after first load, replacing `innerHTML` of each `.filter-group` while preserving the exact same `label.filter-check` markup. Prefer (a) for simplicity unless brand variety grows significantly.

---

## 6. Bike Details Page (`bike-details.html`)

Currently 100% hardcoded to one bike. Replace the inline `<script>` with:

```js
async function loadBikeDetails() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return;

  const { data: bike } = await supabase.from('bikes').select('*').eq('id', id).single();
  const { data: photos } = await supabase
    .from('bike_photos').select('*').eq('bike_id', id).order('sort_order');
  if (!bike) return;

  document.querySelector('.breadcrumb span span').textContent = bike.name;
  document.querySelector('.details-info h1').textContent = bike.name;
  document.querySelector('.details-info .price').innerHTML = `&#8377;${bike.price.toLocaleString('en-IN')}`;
  document.querySelectorAll('.spec-item strong')[0].textContent = bike.year;
  document.querySelectorAll('.spec-item strong')[1].textContent = `${bike.km_driven.toLocaleString()} km`;
  document.querySelectorAll('.spec-item strong')[2].textContent = bike.color || '—';
  document.querySelectorAll('.spec-item strong')[3].textContent = bike.ownership;
  document.querySelector('.description p').textContent = bike.description || '';

  const imgs = photos.length ? photos.map(p => p.image_url) : [bike.cover_image];
  document.querySelector('.main-img').src = imgs[0];
  document.querySelector('.thumb-row').innerHTML = imgs.map((src, i) =>
    `<img src="${src}" alt="Thumb" class="${i === 0 ? 'active' : ''}">`).join('');
  // re-attach the existing thumbnail click listener (already in the file) after innerHTML swap
  attachThumbListeners();

  // luxury ribbon on details page, additive only
  if (bike.is_luxury) {
    const tag = document.createElement('span');
    tag.className = 'luxury-tag';
    tag.textContent = 'LUXURY';
    document.querySelector('.details-gallery').style.position = 'relative';
    document.querySelector('.details-gallery').prepend(tag);
  }

  document.querySelector('.btn-buy').onclick = () => submitEnquiry(bike.id, bike.name);
}
document.addEventListener('DOMContentLoaded', loadBikeDetails);
```

Update every `href="bike-details.html"` (and `href="#"`) link across `bikes.html` and `index.html` to `href="bike-details.html?id=${bike.id}"` once cards are rendered from real data — already handled in §5.4's render function for `bikes.html`; do the same for the 3 hardcoded cards in `index.html`'s "Latest Collections" (fetch 3 most recent bikes from Supabase there too, same pattern, smaller scale).

`.btn-buy` ("CONTACT TO BUY NOW") should open a tiny inline form (name, phone, message) or simply prompt for them, then insert into `enquiries` with that bike's `id`.

---

## 7. Sell Your Bike Form (`sell.html`)

Replace `onsubmit="return false;"` with a real handler. Keep every input exactly as-is; just add `id`s to each input matching the table below, then:

```js
document.querySelector('.contact-form, form').addEventListener... // see below
```

Concretely, add an `id` to the `<form>` (`id="sellForm"`) and to each input (`f-brand, f-model, f-regyear, f-km, f-ownership, f-insurance, f-condition, f-name, f-phone, f-location, f-email`), then:

```js
document.getElementById('sellForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { data: req, error } = await supabase.from('sell_requests').insert({
    brand: val('f-brand'), model: val('f-model'), registration_year: val('f-regyear'),
    km_driven: Number(val('f-km')) || 0, ownership: val('f-ownership'),
    insurance_status: document.querySelector('input[name="insurance"]:checked').nextSibling.textContent.trim(),
    condition: document.querySelector('input[name="condition"]:checked').nextSibling.textContent.trim(),
    seller_name: val('f-name'), phone: val('f-phone'), location: val('f-location'), email: val('f-email')
  }).select().single();

  if (error) { alert('Something went wrong. Please try again.'); return; }

  // upload any photos dropped in the existing upload-box, if files were captured
  for (const file of sellPhotoFiles) {
    const path = `sell-requests/${req.id}/${Date.now()}-${file.name}`;
    await supabase.storage.from('bike-photos').upload(path, file);
    const { data: pub } = supabase.storage.from('bike-photos').getPublicUrl(path);
    await supabase.from('sell_request_photos').insert({ sell_request_id: req.id, image_url: pub.publicUrl });
  }

  alert('Thanks! Our team will contact you with a valuation shortly.');
  e.target.reset();
});
function val(id){ return document.getElementById(id).value.trim(); }
```

The existing `.upload-box` (drag/drop placeholder) needs the same file-capture wiring pattern already built in `admin.js` (`handleFiles`/`dragOver`/`dropFiles`) — duplicate that logic here into a `sellPhotoFiles` array instead of `selectedFiles`.

---

## 8. Contact Form (`index.html`)

Same pattern as §7, simpler — insert into `enquiries` with `bike_id: null`:
```js
document.querySelector('.contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputs = e.target.querySelectorAll('input, textarea');
  await supabase.from('enquiries').insert({
    full_name: inputs[0].value, email: inputs[1].value, phone: inputs[2].value, message: inputs[3].value
  });
  alert('Message sent! We will get back to you soon.');
  e.target.reset();
});
```

---

## 9. Admin Authentication

Replace the hardcoded `ADMIN_ID`/`ADMIN_PASS` check in `admin-login.html` with Supabase Auth:

```js
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminId').value.trim(); // use admin's email as the "Admin ID"
  const password = document.getElementById('adminPass').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('errorMsg').classList.add('show');
    document.getElementById('adminPass').value = '';
    return;
  }
  window.location.href = 'admin-dashboard.html';
}
```

In `admin.js`, replace the `sessionStorage.getItem('kl7_admin')` guard with:
```js
const { data: { session } } = await supabase.auth.getSession();
if (!session) window.location.href = 'admin-login.html';
```
And `logout()` becomes `await supabase.auth.signOut(); window.location.href = 'admin-login.html';`

Create exactly one admin user in Supabase Auth (via dashboard) — this app does not need self-service signup.

---

## 10. Admin Dashboard — Wiring Each Tab to Supabase

### 10.1 Inventory tab
- On load: `supabase.from('bikes').select('*, bike_photos(*)').order('created_at',{ascending:false})` → render into `#inventoryBody` using the **exact existing `<tr>` markup** from `admin-dashboard.html` (same cells/classes), adding `data-id="${bike.id}"` to each `<tr>` for edit/delete targeting.
- `openAddBike()` / `openEditBike()` — unchanged UI, but `openEditBike` now also pre-fills the new `#f-luxury` select (§4) and pulls full bike data via `bike.id` stored in `tr.dataset.id` rather than scraping table text.
- `saveBike()`:
  1. If new bike: `insert` into `bikes` (including `is_luxury`), get back `id`.
  2. Upload each file in `selectedFiles` to Storage bucket `bike-photos/bikes/${id}/...`, then insert a row per photo into `bike_photos` (`sort_order` = array index). Set `bikes.cover_image` to the first uploaded photo's public URL.
  3. If editing: `update` the `bikes` row by `id`; if new photos were added, append to `bike_photos` (decide whether to replace all photos or append — recommend: replace all if any new files selected, to match current admin.js's "first selected file replaces the thumb" behavior).
  4. Re-run the inventory load so the table reflects DB truth (rather than just patching the DOM row, which is today's no-persistence behavior).
- `deleteBike()`: `supabase.from('bikes').delete().eq('id', tr.dataset.id)` (cascades to `bike_photos` via FK), then remove the row from DOM as it already does.
- `filterBikes()` (admin search/status filter): keep client-side, identical logic, just operating on the now-real rows.

### 10.2 Sell Requests tab
- Replace hardcoded `SELL_DATA` array with a Supabase fetch: `supabase.from('sell_requests').select('*, sell_request_photos(image_url)').order('created_at',{ascending:false})`.
- Render into the existing `<tbody>` with the same `<tr>` structure; `viewSellRequest()` reads from the fetched array by `id` (stored as `data-id` on the row) instead of by array index.
- "Accept & Contact" button in the `#sellModal` footer: wire to `supabase.from('sell_requests').update({status:'accepted'}).eq('id', currentSellRequestId)`, then close modal and refresh the table.

### 10.3 Enquiries tab
- Replace hardcoded `.enq-item` blocks with a render function fed by `supabase.from('enquiries').select('*').order('created_at',{ascending:false})`.
- `markRead(btn)` → `supabase.from('enquiries').update({is_read:true}).eq('id', enquiryId)` then existing DOM update logic.
- `replyEnquiry(name)` can stay as a placeholder `alert(...)`, or be upgraded to `mailto:`/`tel:` links using the enquiry's stored email/phone — optional enhancement, not required for "make it work."
- Unread badge counts (`#unreadBadge`, `.sb-badge`, `#notifDot`) all derive from `enquiries.is_read = false` count instead of counting DOM nodes.

### 10.4 Gallery tab
No DB work needed — this stays Curator.io/Instagram-driven exactly as today. Leave untouched.

### 10.5 Settings tab
- On load: fetch the single row from `site_settings`, populate the 4 Business Info inputs.
- "Save Changes" button: add `onclick="saveSettings()"` → `supabase.from('site_settings').update({...}).eq('id',1)`.
- "Update Credentials" button: add `onclick="updateCredentials()"` → `supabase.auth.updateUser({ password: newPassword })` (email/Admin ID changes go through `supabase.auth.updateUser({ email: newEmail })`, which requires email confirmation — flag this to the admin in the UI with a small note, no design change needed beyond existing `<p>` style text if you choose to add one).
- Theme toggle (`setTheme`) stays exactly as-is (uses `localStorage`, purely cosmetic, no backend needed).

### 10.6 Overview tab (KPI cards)
Replace the hardcoded `24` / `8` / `15` numbers with live counts:
```js
const { count: bikesCount } = await supabase.from('bikes').select('*', {count:'exact', head:true});
const { count: sellCount }  = await supabase.from('sell_requests').select('*', {count:'exact', head:true});
const { count: enqCount }   = await supabase.from('enquiries').select('*', {count:'exact', head:true});
```
Map into the existing `.kpi-val` spans by index/ID — add `id="kpiBikes"`, `id="kpiSell"`, `id="kpiEnquiries"` to the three `<strong class="kpi-val">` elements (purely additive attribute, zero visual change).

"Recent Activity" feed can either stay as static placeholder copy (acceptable — it's decorative) or be derived from the most recent rows across `bikes`/`sell_requests`/`enquiries` sorted by `created_at`. Optional, not required for core functionality.

---

## 11. Image Upload Flow (Admin → Storage → Public Pages)

1. Admin selects/drops files in `#uploadZone` (existing UI, unchanged).
2. On `saveBike()`, for each file: `supabase.storage.from('bike-photos').upload(`bikes/${bikeId}/${index}-${file.name}`, file)`.
3. Get the public URL: `supabase.storage.from('bike-photos').getPublicUrl(path).data.publicUrl`.
4. Insert a row into `bike_photos` per file; set `bikes.cover_image` = first photo's URL.
5. Public pages (`bikes.html`, `index.html`, `bike-details.html`) read `cover_image` / `bike_photos` directly — no Unsplash placeholders once real bikes exist. Keep one local fallback image (e.g. `assets/placeholder.png`) for bikes with zero photos.

---

## 12. Build Order (recommended sequence for Antigravity)

1. Supabase project + tables + RLS policies + storage bucket (§2–3).
2. Admin auth swap (§9) — unblocks everything else being tested behind login.
3. Inventory CRUD + image upload in admin dashboard (§10.1, §11) — this is the data-entry point everything else depends on.
4. Public bikes grid: fetch + render + luxury tag (§4, §5.1, §5.4).
5. Filters & sort wiring (§5.2–5.3) — now there is real data to filter.
6. Pagination (§5.4 `renderPagination`/`goToPage`).
7. Bike details page dynamic loading (§6).
8. Sell form → `sell_requests` (§7) + admin Sell Requests tab reading real data (§10.2).
9. Contact form + bike "Contact to Buy Now" → `enquiries` (§6 buy button, §8) + admin Enquiries tab (§10.3).
10. Admin Settings tab (§10.5) + Overview KPIs (§10.6).
11. QA pass: verify every item in the §1 table is now resolved, and that no class names, layout, or styles were altered — only behavior was added.

---

## 13. Explicit Non-Goals

- Do not redesign any page, change fonts, colors, spacing, or layout.
- Do not introduce a frontend framework/build step — keep plain HTML/CSS/vanilla JS + Supabase JS CDN, consistent with the existing codebase.
- Do not touch the Gallery page/tab — it intentionally stays Instagram/Curator.io driven.
- Do not add customer-facing login/signup — only the single admin account needs auth.
