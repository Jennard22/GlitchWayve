/* =========================================================
   GLITCHWAYVE — ONE-FILE JAVASCRIPT
   Beginner map of this file:
     1. Supabase connection         7. Page: Home
     2. Constants (menus, statuses) 8. Pages: Finder, categories, Moving Around,
     3. App state                      Help & Contact, PULSE, Innovation Hub,
     4. Small helpers                  Handbook, Settings, Staff
     5. Database functions          9. Service cards + detail dialog
     6. Login + app shell + routing 10. Forms (request, appointment, booking, borrow, project)
                                    11. Event handling + start-up
   Every database call goes through Supabase with Row Level Security (RLS).
   The browser only ever holds the PUBLISHABLE key.
   ========================================================= */

// =========================================================
// 1. SUPABASE CONNECTION
// =========================================================
// Replace these with your project's URL and publishable key
// (Supabase → Project Settings → API Keys). Never put a secret/service_role key here.
const SUPABASE_URL = "https://kdgtgxkyubwuyolrvktl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e-u14FUMB0xaf-S-pnceRw_fMkBGivx";

const isSupabaseConfigured = /^https?:\/\//.test(SUPABASE_URL) && !SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// =========================================================
// 2. CONSTANTS
// =========================================================
const BUILDINGS = {
  interweave: { name: "Interweave", full: "CIIT Interweave", icon: "building-2", themeColor: "#0b2e4a" },
  glitch: { name: "Glitch Tower", full: "CIIT Glitch Tower", icon: "building", themeColor: "#0e0f12" }
};

// Service categories = the six service pages. (Document Support was merged into Requests.)
const CATEGORIES = [
  { section: "academics", category: "Academics & Formation", icon: "graduation-cap", blurb: "Learning tools, labs, the library and room booking." },
  { section: "requests", category: "Requests", icon: "file-text", blurb: "Registrar requests, school records and equipment borrowing." },
  { section: "careers", category: "Careers", icon: "briefcase-business", blurb: "Practicum, placement and job resources." },
  { section: "student-life", category: "Student Life", icon: "users", blurb: "Communities, events, organizations and PlayLab." },
  { section: "health", category: "Health & Wellness", icon: "heart-pulse", blurb: "Carehub, the clinic and guidance counseling." },
  { section: "support", category: "Support", icon: "life-buoy", blurb: "IT, Edusuite and enrollment help, plus PULSE concerns." }
];

// Sidebar groups. "staffOnly" items appear only for profiles with role = 'staff'.
const NAV_GROUPS = [
  { label: "Find", items: [
    { section: "home", label: "Home", icon: "house" },
    { section: "finder", label: "Find a Service", icon: "search" },
    { section: "moving", label: "Moving Around", icon: "map" },
    { section: "directory", label: "Help & Contact", icon: "contact" }
  ] },
  { label: "Services", items: CATEGORIES.map((c) => ({ section: c.section, label: c.category, icon: c.icon })) },
  { label: "My activity", items: [
    { section: "pulse", label: "PULSE · My Requests", icon: "activity" },
    { section: "innovation", label: "Innovation Hub", icon: "lightbulb" }
  ] },
  { label: "More", items: [
    { section: "handbook", label: "College Handbook", icon: "book-open" },
    { section: "settings", label: "Settings", icon: "settings" },
    { section: "staff", label: "Staff Tools", icon: "shield-check", staffOnly: true }
  ] }
];

// Personal record types shown in PULSE. "flow" = the normal path; other statuses stop the flow.
const RECORD_TYPES = {
  requests: { label: "Request", icon: "file-text", flow: ["Submitted", "In review", "Approved", "Ready for pickup", "Completed"] },
  appointments: { label: "Appointment", icon: "calendar-check", flow: ["Submitted", "Confirmed", "Completed"] },
  bookings: { label: "Room booking", icon: "calendar-days", flow: ["Submitted", "Approved", "Completed"] },
  borrow_records: { label: "Equipment", icon: "package", flow: ["Submitted", "Approved", "Borrowed", "Returned"] },
  projects: { label: "Project", icon: "lightbulb", flow: ["Submitted", "In review", "Accepted"] }
};
const ALL_STATUSES = {
  requests: ["Submitted", "In review", "Approved", "Ready for pickup", "Completed", "Declined", "Cancelled"],
  appointments: ["Submitted", "Confirmed", "Rescheduled", "Completed", "Declined", "Cancelled"],
  bookings: ["Submitted", "Approved", "Declined", "Completed", "Cancelled"],
  borrow_records: ["Submitted", "Approved", "Borrowed", "Returned", "Declined", "Cancelled"],
  projects: ["Submitted", "In review", "Accepted", "Needs revision", "Declined", "Cancelled"]
};
const TIME_SLOTS = ["8:00 – 9:00 AM", "9:00 – 10:00 AM", "10:00 – 11:00 AM", "11:00 AM – 12:00 NN", "1:00 – 2:00 PM", "2:00 – 3:00 PM", "3:00 – 4:00 PM", "4:00 – 5:00 PM"];

// =========================================================
// 3. APP STATE
// =========================================================
const state = {
  user: null,
  profile: null,
  building: localStorage.getItem("gw-building") || "interweave",
  section: "home",
  finderTerm: "",
  finderCategory: "all",
  floorId: null,
  pulseTab: "all",
  staffTab: "records",
  data: { services: [], offices: [], loaded: false },
  shortcutPrefs: {},
  unread: 0,
  textSize: localStorage.getItem("gw-text-size") || "16px",
  highContrast: localStorage.getItem("gw-high-contrast") === "true"
};

// =========================================================
// 4. SMALL HELPERS
// =========================================================
/** Escapes text before it goes into HTML, so database text can never become code. */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
/** Allows only http(s) links from the database. */
function safeUrl(url) {
  try { const u = new URL(url); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; }
}
function formatDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-PH", withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}
function todayString() { return new Date().toISOString().slice(0, 10); }
function buildingName(key = state.building) { return BUILDINGS[key]?.name || "Campus"; }
function otherBuilding(key = state.building) { return key === "interweave" ? "glitch" : "interweave"; }
function isStaff() { return state.profile?.role === "staff"; }
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function icon(name, extra = "") { return `<i data-lucide="${escapeHTML(name || "circle-dot")}" ${extra}></i>`; }
function neonClass(text) { let h = 0; for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 997; return `neon-${h % 5}`; }

function showToast(message, isError = false) {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = `toast ${isError ? "error" : ""}`;
  el.innerHTML = `${icon(isError ? "alert-triangle" : "check-circle-2")}<span>${escapeHTML(message)}</span>`;
  root.appendChild(el);
  refreshIcons();
  setTimeout(() => el.remove(), isError ? 6000 : 3500);
}

/** Opens a dialog. Focus moves into it; Escape or the X closes it. */
function showDialog(title, bodyHTML, { wide = false, description = "" } = {}) {
  const root = document.getElementById("dialogRoot");
  state.lastFocus = document.activeElement;
  root.innerHTML = `
    <div class="dialog-backdrop" data-action="close-dialog-backdrop">
      <div class="dialog ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
        <div class="dialog-head">
          <div><h2 id="dialogTitle">${escapeHTML(title)}</h2>${description ? `<p class="muted" style="margin:4px 0 0">${escapeHTML(description)}</p>` : ""}</div>
          <button class="icon-button" type="button" data-action="close-dialog" aria-label="Close">${icon("x")}</button>
        </div>
        <div class="dialog-body">${bodyHTML}</div>
      </div>
    </div>`;
  refreshIcons();
  const first = root.querySelector("input, select, textarea, .dialog-body button, .dialog-body a");
  (first || root.querySelector(".dialog")).focus();
}
function closeDialog() {
  document.getElementById("dialogRoot").innerHTML = "";
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function renderPageHeader(title, description, eyebrow = "", actionsHTML = "") {
  return `
    <div class="page-header">
      <div>
        ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
        <h1>${escapeHTML(title)}</h1>
        ${description ? `<p>${description}</p>` : ""}
      </div>
      ${actionsHTML ? `<div class="row">${actionsHTML}</div>` : ""}
    </div>`;
}
function renderEmptyState(title, message, iconName = "inbox", actionHTML = "") {
  return `<div class="empty-state">${icon(iconName)}<h3 style="margin-top:10px">${escapeHTML(title)}</h3><p class="muted">${message}</p>${actionHTML}</div>`;
}
function renderLoading(count = 3) {
  return `<div class="grid grid-auto">${Array.from({ length: count }, () => '<div class="skeleton"></div>').join("")}</div>`;
}
/** Friendly error with a way to continue (retry or contact). */
function showPageError(error) {
  console.error(error);
  const offline = !navigator.onLine;
  document.getElementById("mainContent").innerHTML = `
    <div class="error-state" role="alert">
      <span class="error-label">${icon("alert-octagon")} Error</span>
      <h2 style="margin-top:8px">We couldn't load this page.</h2>
      <p>${offline ? "You seem to be offline. Check your connection, then try again." : "Something went wrong while loading information. Your search and building choice are kept."}</p>
      <div class="row">
        <button class="btn btn-primary" type="button" data-action="retry">${icon("rotate-cw")} Try again</button>
        <button class="btn" type="button" data-section="directory">${icon("contact")} Help & Contact</button>
      </div>
    </div>`;
  refreshIcons();
}
/** Logo area. Put the CIIT logo at assets/ciit-logo.png (or change BRAND_LOGO).
    If the file is missing, the text placeholder below is shown instead. */
const BRAND_LOGO = "assets/ciit-logo.png";
function renderBrand() {
  return `
    <div class="brand">
      <img class="brand-logo" src="${BRAND_LOGO}" alt="CIIT College of Innovation and Integrated Technology"
        onerror="this.hidden = true; this.nextElementSibling.hidden = false;">
      <div class="brand-fallback" hidden>
        <div class="brand-mark">G</div>
        <div class="brand-copy"><span class="brand-name">GLITCHWAYVE</span><span class="brand-caption">CIIT STUDENT DASHBOARD</span></div>
      </div>
    </div>`;
}
function applyAccessibilitySettings() {
  document.documentElement.style.setProperty("--font-size", state.textSize);
  document.documentElement.classList.toggle("high-contrast", state.highContrast);
}
function applyBuildingTheme() {
  document.documentElement.dataset.building = state.building;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", BUILDINGS[state.building].themeColor);
}

// =========================================================
// 5. DATABASE FUNCTIONS
// =========================================================
async function getProfile() {
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
  if (error) throw error;
  return data;
}
/** Loads shared info once per session: all services (both buildings) and offices. */
async function loadSharedData(force = false) {
  if (state.data.loaded && !force) return;
  const [services, offices, prefs] = await Promise.all([
    supabaseClient.from("services").select("*").eq("is_active", true).order("name"),
    supabaseClient.from("offices").select("*").order("name"),
    supabaseClient.from("shortcut_preferences").select("*")
  ]);
  if (services.error) throw services.error;
  if (offices.error) throw offices.error;
  state.data.services = services.data;
  state.data.offices = offices.data;
  state.shortcutPrefs = Object.fromEntries((prefs.data || []).map((p) => [p.service_code, p]));
  state.data.loaded = true;
}
async function getAnnouncements() {
  const [{ data, error }, dismissed] = await Promise.all([
    supabaseClient.from("announcements").select("*").or(`building_key.is.null,building_key.eq.${state.building}`).order("published_at", { ascending: false }),
    supabaseClient.from("dismissed_announcements").select("announcement_id")
  ]);
  if (error) throw error;
  const hidden = new Set((dismissed.data || []).map((d) => d.announcement_id));
  return { visible: data.filter((a) => !hidden.has(a.id)), hiddenCount: data.filter((a) => hidden.has(a.id)).length };
}
async function getFloorsAndRooms(buildingKey = state.building) {
  const [floors, rooms] = await Promise.all([
    supabaseClient.from("floors").select("*").eq("building_key", buildingKey).order("floor_number", { ascending: false }),
    supabaseClient.from("rooms").select("*").eq("building_key", buildingKey).order("room_number")
  ]);
  if (floors.error) throw floors.error;
  if (rooms.error) throw rooms.error;
  return { floors: floors.data, rooms: rooms.data };
}
async function getBookableRooms() {
  const { data, error } = await supabaseClient.from("rooms").select("*").eq("is_bookable", true).order("name");
  if (error) throw error;
  return data;
}
async function getEquipmentWithAvailability() {
  const { data, error } = await supabaseClient.from("equipment").select("*").order("name");
  if (error) throw error;
  const counts = await Promise.all(data.map((e) => supabaseClient.rpc("equipment_available", { p_equipment_id: e.id })));
  return data.map((e, i) => ({ ...e, available: counts[i].error ? null : counts[i].data }));
}
async function getDocuments() {
  const { data, error } = await supabaseClient.from("documents").select("*").order("published_at", { ascending: false });
  if (error) throw error;
  return data;
}
/** All of the signed-in student's records + their status history (RLS keeps this to their own rows). */
async function getMyRecords() {
  const tables = Object.keys(RECORD_TYPES);
  const selects = {
    requests: "*", appointments: "*", bookings: "*, rooms(name, room_number, building_key)",
    borrow_records: "*, equipment(name, location)", projects: "*"
  };
  const results = await Promise.all(tables.map((t) => {
    let query = supabaseClient.from(t).select(selects[t]).order("created_at", { ascending: false });
    if (!isStaff()) query = query.eq("student_id", state.user.id);
    return query;
  }));
  const records = [];
  results.forEach((res, i) => {
    if (res.error) throw res.error;
    res.data.forEach((row) => records.push({ ...row, _type: tables[i] }));
  });
  const ids = records.map((r) => r.id);
  let events = [];
  if (ids.length) {
    const ev = await supabaseClient.from("status_events").select("*").in("record_id", ids).order("created_at");
    if (!ev.error) events = ev.data;
  }
  records.forEach((r) => { r._events = events.filter((e) => e.record_id === r.id); });
  return records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
async function getNotifications() {
  const { data, error } = await supabaseClient.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data;
}
async function refreshUnreadCount() {
  const { count } = await supabaseClient.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
  state.unread = count || 0;
  const dot = document.getElementById("notifDot");
  if (dot) dot.hidden = state.unread === 0;
}

// =========================================================
// 6. LOGIN, APP SHELL AND ROUTING
// =========================================================
function renderLoginScreen(message = "") {
  const screen = document.getElementById("loginScreen");
  document.getElementById("dashboard").hidden = true;
  screen.hidden = false;
  applyBuildingTheme();
  screen.innerHTML = `
    <div class="login-art">
      ${renderBrand()}
      <div>
        <h1>Find any service in Interweave and Glitch Tower.</h1>
        <p>Where it is, when it's open, what to bring, and what happens after you submit.</p>
      </div>
      <p style="font-size:.85rem;opacity:.75">Prototype for CS214 · Some details are sample data.</p>
    </div>
    <div class="login-panel">
      <form class="login-card" id="loginForm" novalidate>
        <h2 id="loginTitle">Sign in</h2>
        <p class="muted">Use your CIIT test account.</p>
        ${isSupabaseConfigured ? "" : `<div class="setup-warning"><strong>Setup needed:</strong> add your Supabase URL and publishable key at the top of <code>script.js</code>.</div>`}
        <div class="field">
          <label for="loginEmail">CIIT email</label>
          <input id="loginEmail" name="email" type="email" placeholder="name@ciit.edu.ph" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="loginPassword">Password</label>
          <input id="loginPassword" name="password" type="password" autocomplete="current-password" required>
        </div>
        <p class="form-error" id="loginError" role="alert">${escapeHTML(message)}</p>
        <button class="btn btn-primary" style="width:100%" type="submit" ${isSupabaseConfigured ? "" : "disabled"}>Sign in ${icon("arrow-right")}</button>
        <p class="form-help" style="margin-top:14px">Class prototype: don't enter your real CIIT password.</p>
      </form>
    </div>`;
  refreshIcons();
}

async function signIn(form) {
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const errorEl = document.getElementById("loginError");
  if (!email.endsWith("@ciit.edu.ph")) { errorEl.textContent = "Use your CIIT email address ending in @ciit.edu.ph."; form.elements.email.focus(); return; }
  if (!password) { errorEl.textContent = "Enter your password."; form.elements.password.focus(); return; }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true; button.textContent = "Signing in…";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = "We couldn't sign you in. Check your email and password, then try again.";
    button.disabled = false; button.innerHTML = `Sign in ${icon("arrow-right")}`; refreshIcons();
    return;
  }
  state.user = data.user;
  await openDashboard();
}
async function signOut() {
  await supabaseClient.auth.signOut();
  state.user = null; state.profile = null; state.data.loaded = false;
  closeDialog();
  renderLoginScreen();
}

async function openDashboard() {
  document.getElementById("loginScreen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  document.getElementById("mainContent").innerHTML = renderLoading(6);
  try {
    state.profile = await getProfile();
    await loadSharedData();
  } catch (error) {
    renderAppShell();
    showPageError(error);
    return;
  }
  renderChatbotLauncher();
  if (!location.hash) location.hash = `#/${state.building}/home`;
  handleRouteChange();
  refreshUnreadCount();
}

function navigateTo(section) {
  const hash = `#/${state.building}/${section}`;
  if (location.hash === hash) handleRouteChange(); else location.hash = hash;
}
function setBuilding(key) {
  if (!BUILDINGS[key] || key === state.building) return;
  state.floorId = null;
  location.hash = `#/${key}/${state.section}`;
  const live = document.getElementById("buildingLive");
  if (live) live.textContent = `Now showing ${buildingName(key)}`;
}

/** Reads #/building/section from the URL so Back/Forward work. */
function handleRouteChange() {
  if (!state.user) return;
  const [, building, section] = location.hash.split("/");
  if (BUILDINGS[building]) { state.building = building; localStorage.setItem("gw-building", building); }
  const known = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.section);
  state.section = known.includes(section) ? section : "home";
  if (state.section === "staff" && !isStaff()) state.section = "home";
  applyBuildingTheme();
  renderAppShell();
  renderCurrentPage();
}

function renderAppShell() {
  const name = state.profile?.full_name || state.user?.email?.split("@")[0] || "Student";
  const initials = name.split(/[\s.,]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  document.getElementById("sidebar").innerHTML = `
    ${renderBrand()}
    ${NAV_GROUPS.map((group) => {
      const items = group.items.filter((i) => !i.staffOnly || isStaff());
      return `<div class="nav-group-label">${group.label}</div>` + items.map((item) => `
        <button class="nav-link ${state.section === item.section ? "active" : ""}" type="button" data-section="${item.section}"
          ${state.section === item.section ? 'aria-current="page"' : ""} title="${escapeHTML(item.label)}">
          ${icon(item.icon)}<span>${escapeHTML(item.label)}</span>
        </button>`).join("");
    }).join("")}
    <div class="sidebar-footer">${icon(BUILDINGS[state.building].icon)} Viewing <strong>${buildingName()}</strong></div>`;

  document.getElementById("topbar").innerHTML = `
    <form class="topbar-search" role="search" data-form="global-search">
      ${icon("search")}
      <label class="sr-only" for="globalSearch">Search services, rooms and offices in both buildings</label>
      <input id="globalSearch" type="search" placeholder="Search services, rooms, offices…" value="${escapeHTML(state.finderTerm)}" autocomplete="off">
    </form>
    <div class="topbar-right">
      <div class="building-switch" role="group" aria-label="Choose building">
        ${Object.entries(BUILDINGS).map(([key, b]) => `
          <button type="button" data-building-key="${key}" aria-pressed="${state.building === key}">
            ${icon(b.icon)}<span class="label-full">${b.name}</span>
          </button>`).join("")}
      </div>
      <span class="sr-only" id="buildingLive" aria-live="polite"></span>
      <button class="icon-button" type="button" data-action="open-notifications" aria-label="Notifications">${icon("bell")}<span class="dot" id="notifDot" ${state.unread ? "" : "hidden"}></span></button>
      <button class="profile-button" type="button" data-action="open-profile-menu" aria-haspopup="true">
        <span class="avatar">${escapeHTML(initials || "S")}</span><span class="profile-name">${escapeHTML(name)}</span>${icon("chevron-down")}
      </button>
    </div>`;
  refreshIcons();
}

function renderChatbotLauncher() {
  if (document.getElementById("chatbotLauncher")) return;
  const btn = document.createElement("button");
  btn.id = "chatbotLauncher"; btn.className = "chatbot-launcher"; btn.type = "button";
  btn.dataset.action = "open-chatbot";
  btn.innerHTML = `${icon("message-circle-question")}<span>Ask GlitchWayve</span>`;
  document.body.appendChild(btn);
  refreshIcons();
}

async function renderCurrentPage() {
  const main = document.getElementById("mainContent");
  main.innerHTML = renderLoading(6);
  const category = CATEGORIES.find((c) => c.section === state.section);
  try {
    if (state.section === "home") await renderHomePage();
    else if (state.section === "finder") renderFinderPage();
    else if (category) renderCategoryPage(category);
    else if (state.section === "moving") await renderMovingPage();
    else if (state.section === "directory") renderDirectoryPage();
    else if (state.section === "pulse") await renderPulsePage();
    else if (state.section === "innovation") await renderInnovationPage();
    else if (state.section === "handbook") await renderHandbookPage();
    else if (state.section === "settings") renderSettingsPage();
    else if (state.section === "staff") await renderStaffPage();
  } catch (error) {
    showPageError(error);
    return;
  }
  refreshIcons();
}

// =========================================================
// 7. PAGE: HOME
// =========================================================
function servicesIn(building = state.building) { return state.data.services.filter((s) => s.building_key === building); }
function serviceByCode(code, building = state.building) { return state.data.services.find((s) => s.service_code === code && s.building_key === building); }
function officeByKey(key) { return state.data.offices.find((o) => o.office_key === key); }

/** Quick access (Feature 3): pinned first, then up to 4 matches for the student's
    program/year, then the most-used services. Hidden ones never appear. */
function getQuickAccess(limit = 8) {
  const program = state.profile?.program;
  const year = state.profile?.year_level;
  const prefs = state.shortcutPrefs;
  const pool = servicesIn()
    .filter((s) => !prefs[s.service_code]?.is_hidden)
    .filter((s) => !program || !s.programs || s.programs.includes(program))
    .filter((s) => !year || !s.year_levels || s.year_levels.includes(year));
  const pinned = pool.filter((s) => prefs[s.service_code]?.is_pinned);
  const matched = pool.filter((s) => !pinned.includes(s) && ((program && s.programs?.includes(program)) || (year && s.year_levels?.includes(year))))
    .sort((a, b) => Number(b.is_popular) - Number(a.is_popular) || a.name.localeCompare(b.name)).slice(0, 4);
  const popular = pool.filter((s) => s.is_popular && !pinned.includes(s) && !matched.includes(s));
  return [...pinned, ...matched, ...popular].slice(0, limit);
}

async function renderHomePage() {
  const name = (state.profile?.full_name || "").split(/[\s,]+/)[0] || "there";
  const [{ visible, hiddenCount }, allRecords] = await Promise.all([getAnnouncements(), getMyRecords()]);
  const records = allRecords.filter((r) => r.student_id === state.user.id);
  const carehub = serviceByCode("carehub");
  const quick = getQuickAccess();
  const popular = servicesIn().filter((s) => s.is_popular).slice(0, 6);
  const open = records.filter((r) => !["Completed", "Returned", "Declined", "Cancelled", "Accepted"].includes(r.status));
  const needsProfile = !state.profile?.program || !state.profile?.year_level;

  document.getElementById("mainContent").innerHTML = `
    <section class="hero" aria-labelledby="homeTitle">
      <div style="position:relative;z-index:1">
        <span class="badge">${icon(BUILDINGS[state.building].icon)} ${BUILDINGS[state.building].full}</span>
        <h1 id="homeTitle">Hello, ${escapeHTML(name)}!</h1>
        <p>Find where a service is, when it's open, and what to bring — in ${buildingName()} or across campus.</p>
      </div>
      <div class="hero-actions">
        ${carehub ? `<button class="btn btn-hero" type="button" data-action="open-service" data-id="${carehub.id}">${icon("heart-pulse")} Carehub check-in</button>` : ""}
        <button class="btn btn-hero-ghost" type="button" data-section="pulse">${icon("activity")} My requests${open.length ? ` (${open.length} open)` : ""}</button>
      </div>
    </section>

    <section class="card announcements-top" aria-labelledby="annTitle">
        <div class="section-head"><h2 id="annTitle">${icon("megaphone")} Announcements</h2>
          ${hiddenCount ? `<button class="btn btn-sm btn-ghost" type="button" data-action="restore-announcements">Show ${hiddenCount} hidden</button>` : ""}</div>
        ${visible.length ? visible.map((a) => `
          <article class="announcement">
            <div class="row"><span class="badge badge-info">${escapeHTML(a.tag || "Announcement")}</span><span class="muted" style="font-size:.85rem">${formatDate(a.published_at)}</span><span class="spacer"></span>
              <button class="btn btn-sm btn-ghost" type="button" data-action="dismiss-announcement" data-id="${a.id}" aria-label="Hide announcement: ${escapeHTML(a.title)}">${icon("eye-off")} Hide</button></div>
            <h3 style="margin-top:8px">${escapeHTML(a.title)}</h3>
            <p class="muted" style="margin:0">${escapeHTML(a.body)}</p>
          </article>`).join("") : '<p class="muted">You\'re all caught up.</p>'}
    </section>

    <form class="finder-box" data-form="home-search" role="search">
      <label class="sr-only" for="homeSearch">Find a service</label>
      <div class="finder-input">${icon("search")}<input id="homeSearch" type="search" placeholder="What do you need? e.g. transcript, clinic, Mac lab, ID" value="${escapeHTML(state.finderTerm)}"></div>
      <div class="chips" aria-label="Browse by category">
        ${CATEGORIES.map((c) => `<button class="chip" type="button" data-section="${c.section}">${icon(c.icon)} ${escapeHTML(c.category)}</button>`).join("")}
      </div>
    </form>

    ${needsProfile ? `
      <div class="notice section" role="note">${icon("sparkles")}
        <div><strong>Personalize your shortcuts.</strong> Tell us your program and year so Quick Access shows what's relevant to you.
        <button class="btn btn-sm" style="margin-left:6px" type="button" data-action="edit-profile">Set program & year</button></div>
      </div>` : ""}

    <section class="section" aria-labelledby="quickTitle">
      <div class="section-head">
        <h2 id="quickTitle">Quick access</h2>
        <button class="btn btn-sm" type="button" data-action="edit-shortcuts">${icon("sliders-horizontal")} Customize</button>
      </div>
      ${quick.length ? `<div class="quick-grid">${quick.map((s) => `
        <button class="quick-tile ${state.shortcutPrefs[s.service_code]?.is_pinned ? "pinned" : ""} ${neonClass(s.name)}" type="button" data-action="open-service" data-id="${s.id}">
          <span class="service-icon">${icon(s.icon_name)}</span>
          <span>${escapeHTML(s.name)}<br><small>${escapeHTML(s.category)}</small></span>
        </button>`).join("")}</div>`
        : renderEmptyState("No shortcuts yet", "Use Customize to pin the services you use most.", "pin")}
    </section>

    <div class="grid grid-2 section">
      <section class="card" aria-labelledby="popularTitle">
        <div class="section-head"><h2 id="popularTitle">Frequently searched</h2><span class="badge badge-building">${buildingName()}</span></div>
        ${popular.length ? popular.map((s) => `
          <button class="nav-link" style="color:var(--text);opacity:1" type="button" data-action="open-service" data-id="${s.id}">
            ${icon(s.icon_name)}<span><strong>${escapeHTML(s.name)}</strong><br><small class="muted">${escapeHTML(locationLine(s))}${s.hours ? " · " + escapeHTML(s.hours) : ""}</small></span>
          </button>`).join("") : '<p class="muted">No popular services listed for this building yet.</p>'}
      </section>
      <section class="card" aria-labelledby="recentTitle">
        <div class="section-head"><h2 id="recentTitle">My recent activity</h2><button class="btn btn-sm" type="button" data-section="pulse">View all</button></div>
        ${records.length ? `<div class="grid">${records.slice(0, 3).map(renderRecordSummary).join("")}</div>`
          : renderEmptyState("Nothing submitted yet", "Requests, bookings and appointments you submit will appear here with their status.", "inbox")}
      </section>
    </div>`;
}

function renderRecordSummary(r) {
  return `
    <button class="record-card" style="text-align:left;color:var(--text)" type="button" data-section="pulse">
      <div class="row">${icon(RECORD_TYPES[r._type].icon)}<strong>${escapeHTML(recordTitle(r))}</strong></div>
      <p class="muted" style="margin:6px 0">${RECORD_TYPES[r._type].label} · ${formatDate(r.created_at)}</p>
      ${statusPill(r.status)}
    </button>`;
}

// =========================================================
// 8. PAGES
// =========================================================
/** Builds the location text, e.g. "Glitch Tower · 6F · Room 602" or "Online". */
function locationLine(s) {
  if (s.service_type === "Online") return "Online · available anywhere";
  const parts = [buildingName(s.building_key)];
  if (s.area_name) parts.push(s.area_name);
  if (s.floor_label && s.floor_label !== s.area_name) parts.push(s.floor_label);
  if (s.room_number && s.room_number !== s.area_name) parts.push(/^\d/.test(s.room_number) ? `Room ${s.room_number}` : s.room_number);
  return parts.join(" · ");
}

/** Text search across services, offices and rooms in BOTH buildings (current building first). */
function searchServices(term) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return state.data.services
    .map((s) => {
      const office = officeByKey(s.office_key);
      const hay = [s.name, s.description, s.category, s.room_number, s.floor_label, s.area_name, office?.name, ...(s.requirements || [])].join(" ").toLowerCase();
      const name = s.name.toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      const score = hits === words.length ? hits * 10 + (name.includes(words[0]) ? 5 : 0) + (s.building_key === state.building ? 3 : 0) : 0;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/** Splits services into: here, also-elsewhere badges, and "only at the other building". */
function splitByBuilding(list) {
  const here = list.filter((s) => s.building_key === state.building);
  const hereCodes = new Set(here.map((s) => s.service_code));
  const onlyOther = list.filter((s) => s.building_key !== state.building && !hereCodes.has(s.service_code));
  const seen = new Set();
  return { here, onlyOther: onlyOther.filter((s) => !seen.has(s.service_code) && seen.add(s.service_code)) };
}

function renderOtherBuildingSection(list, openByDefault = false) {
  if (!list.length) return "";
  const other = otherBuilding();
  return `
    <details class="other-building" ${openByDefault ? "open" : ""}>
      <summary>${icon(BUILDINGS[other].icon)} Available at ${buildingName(other)} only <span class="badge">${list.length}</span>
        <span class="muted" style="font-weight:500">— not offered in ${buildingName()}</span></summary>
      <div class="grid grid-auto">${list.map((s) => renderServiceCard(s)).join("")}</div>
    </details>`;
}

function renderFinderPage() {
  const term = state.finderTerm.trim();
  const base = term ? searchServices(term) : state.data.services;
  const filtered = state.finderCategory === "all" ? base : base.filter((s) => s.category === state.finderCategory);
  const { here, onlyOther } = splitByBuilding(filtered);

  let results;
  if (term && !here.length && !onlyOther.length) {
    const suggestions = servicesIn().filter((s) => s.is_popular).slice(0, 4);
    results = `
      <div class="empty-state" role="status">
        ${icon("search-x")}
        <h3 style="margin-top:10px">We couldn't find "${escapeHTML(term)}".</h3>
        <p class="muted">Try a different keyword, browse by category, or ask an office directly.</p>
        <div class="chips" style="justify-content:center">
          ${suggestions.map((s) => `<button class="chip" type="button" data-action="open-service" data-id="${s.id}">${icon(s.icon_name)} ${escapeHTML(s.name)}</button>`).join("")}
        </div>
        <div class="row" style="justify-content:center;margin-top:14px">
          <button class="btn" type="button" data-action="clear-search">${icon("x")} Clear search</button>
          <button class="btn btn-primary" type="button" data-section="directory">${icon("contact")} Help & Contact</button>
        </div>
      </div>`;
  } else {
    results = `
      <p class="muted" role="status">${term ? `${here.length} result${here.length === 1 ? "" : "s"} in ${buildingName()} for "${escapeHTML(term)}"` : `${here.length} services in ${buildingName()}`}${onlyOther.length ? ` · ${onlyOther.length} more at ${buildingName(otherBuilding())}` : ""}</p>
      ${here.length ? `<div class="grid grid-auto">${here.map((s) => renderServiceCard(s)).join("")}</div>`
        : renderEmptyState(`Not offered in ${buildingName()}`, `See the services available at ${buildingName(otherBuilding())} below.`, "building")}
      ${renderOtherBuildingSection(onlyOther, !here.length)}`;
  }

  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Find a Service", `Search or browse everything offered in <strong>${buildingName()}</strong>. Each card shows the floor, room and hours.`, `${icon("search")} Service & facility finder`)}
    <form data-form="finder-search" role="search">
      <label class="sr-only" for="finderSearch">Search services</label>
      <div class="finder-input">${icon("search")}<input id="finderSearch" type="search" placeholder="Search by service, office, room or requirement" value="${escapeHTML(state.finderTerm)}"></div>
    </form>
    <div class="chips" role="group" aria-label="Filter by category">
      <button class="chip" type="button" data-action="finder-category" data-category="all" aria-pressed="${state.finderCategory === "all"}">All</button>
      ${CATEGORIES.map((c) => `<button class="chip" type="button" data-action="finder-category" data-category="${escapeHTML(c.category)}" aria-pressed="${state.finderCategory === c.category}">${escapeHTML(c.category)}</button>`).join("")}
    </div>
    <div class="section" style="margin-top:18px">${results}</div>`;
}

function renderCategoryPage(cat) {
  const all = state.data.services.filter((s) => s.category === cat.category);
  const { here, onlyOther } = splitByBuilding(all);
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader(cat.category, `${escapeHTML(cat.blurb)} Showing what's available in <strong>${buildingName()}</strong>.`, `${icon(cat.icon)} ${buildingName()}`)}
    ${here.length ? `<div class="grid grid-auto">${here.map((s) => renderServiceCard(s)).join("")}</div>`
      : renderEmptyState(`No ${cat.category} services in ${buildingName()}`, `They're offered at ${buildingName(otherBuilding())} — see below.`, "building")}
    ${renderOtherBuildingSection(onlyOther, !here.length)}`;
}

async function renderMovingPage() {
  const { floors, rooms } = await getFloorsAndRooms();
  const noFloor = rooms.filter((r) => !r.floor_id);
  const floorList = [...floors];
  if (noFloor.length) floorList.push({ id: "none", floor_label: "Floor not confirmed", is_hypothetical: true });
  if (!state.floorId || !floorList.some((f) => f.id === state.floorId)) state.floorId = floorList[0]?.id || null;
  const floor = floorList.find((f) => f.id === state.floorId);
  const floorRooms = floor ? (floor.id === "none" ? noFloor : rooms.filter((r) => r.floor_id === floor.id)) : [];
  const servicesOnFloor = floor ? servicesIn().filter((s) => s.floor_label && floor.floor_label && s.floor_label.includes(floor.floor_label) && s.service_type !== "Online") : [];

  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader(`Moving Around ${buildingName()}`, "Pick a floor to see its rooms and the services located there.", `${icon("map")} Floor directory`)}
    ${floorList.length ? `
    <div class="floor-layout">
      <div class="floor-list" role="group" aria-label="Floors">
        ${floorList.map((f) => `
          <button class="floor-button" type="button" data-action="select-floor" data-id="${f.id}" aria-pressed="${f.id === state.floorId}">
            <span>${escapeHTML(f.floor_label)}</span>${f.is_off_limits ? '<span class="badge">Off limits</span>' : f.area_name ? `<span class="badge">${escapeHTML(f.area_name)}</span>` : ""}
          </button>`).join("")}
      </div>
      <div>
        ${floor?.is_off_limits ? `<div class="notice">${icon("ban")} <span><strong>${escapeHTML(floor.floor_label)} is off limits to students.</strong> Follow campus safety instructions.</span></div>` : ""}
        ${floor?.is_hypothetical ? `<div class="notice notice-sample" style="margin-bottom:12px">${icon("flask-conical")} <span>Location details on this floor are sample data and need to be verified with CIIT.</span></div>` : ""}
        ${floorRooms.length ? `<div class="grid grid-auto">${floorRooms.map(renderRoomCard).join("")}</div>`
          : floor?.is_off_limits ? "" : renderEmptyState("No rooms listed", "Rooms for this floor haven't been added yet.", "door-closed")}
        ${servicesOnFloor.length ? `<h2 class="section">Services on ${escapeHTML(floor.floor_label)}</h2><div class="grid grid-auto">${servicesOnFloor.map((s) => renderServiceCard(s)).join("")}</div>` : ""}
      </div>
    </div>` : renderEmptyState("No floor directory yet", `Floors for ${buildingName()} haven't been added.`, "map")}`;
}

function renderRoomCard(r) {
  return `
    <article class="card">
      <div class="row"><span class="service-icon">${icon(r.room_type?.includes("Lab") ? "monitor" : r.is_bookable ? "calendar-days" : "door-open")}</span>
        <div><h3 style="margin:0">${escapeHTML(r.name)}</h3><span class="muted" style="font-size:.88rem">${escapeHTML(r.room_type || "Room")}${r.capacity ? ` · up to ${r.capacity}` : ""}</span></div></div>
      <div class="service-meta" style="margin-top:10px">
        ${r.purpose ? `<span>${icon("info")} ${escapeHTML(r.purpose)}</span>` : ""}
        ${r.hours ? `<span>${icon("clock")} ${escapeHTML(r.hours)}</span>` : ""}
      </div>
      <div class="row" style="margin-top:10px">
        ${r.is_hypothetical ? '<span class="badge badge-sample">Sample data</span>' : ""}
        ${r.is_bookable ? `<span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" data-action="open-booking-form" data-room="${r.id}">${icon("calendar-plus")} Book</button>` : ""}
      </div>
    </article>`;
}

function renderDirectoryPage() {
  const offices = [...state.data.offices].sort((a, b) => (a.building_key === state.building ? -1 : 1) - (b.building_key === state.building ? -1 : 1) || a.name.localeCompare(b.name));
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Help & Contact", "Who to ask when you can't find something — with hours, location and what to bring. Offices in other buildings are listed too.", `${icon("contact")} Office directory`)}
    <div class="grid grid-2">${offices.map(renderOfficeCard).join("")}</div>`;
}

function renderOfficeCard(o, compact = false) {
  const handled = state.data.services.filter((s) => s.office_key === o.office_key && s.building_key === o.building_key).slice(0, 6);
  return `
    <article class="card">
      <div class="row"><span class="service-icon">${icon("building-2")}</span>
        <div><h3 style="margin:0">${escapeHTML(o.name)}</h3><span class="badge badge-building">${buildingName(o.building_key)}</span></div></div>
      ${o.description ? `<p class="muted" style="margin:10px 0">${escapeHTML(o.description)}</p>` : ""}
      <div class="service-meta">
        <span>${icon("map-pin")} ${escapeHTML([buildingName(o.building_key), o.floor_label, o.room_number].filter(Boolean).join(" · ") || "Location not yet added")}</span>
        <span>${icon("clock")} ${escapeHTML(o.hours || "Hours not yet added")}</span>
        ${o.what_to_bring ? `<span>${icon("backpack")} Bring: ${escapeHTML(o.what_to_bring)}</span>` : ""}
        ${o.email ? `<span>${icon("mail")} <a href="mailto:${escapeHTML(o.email)}">${escapeHTML(o.email)}</a>
          <button class="btn btn-sm btn-ghost" type="button" data-action="copy-email" data-email="${escapeHTML(o.email)}" aria-label="Copy ${escapeHTML(o.email)}">${icon("copy")}</button></span>` : ""}
      </div>
      <div class="badges" style="margin-top:10px">${o.details_verified ? '<span class="badge badge-ok">Verified</span>' : '<span class="badge badge-sample">Sample details</span>'}
        ${o.is_hypothetical ? '<span class="badge badge-sample">Location unconfirmed</span>' : ""}</div>
      ${!compact && handled.length ? `<p class="muted" style="margin:12px 0 4px;font-size:.85rem">Handles: ${handled.map((s) => escapeHTML(s.name)).join(", ")}</p>` : ""}
    </article>`;
}

// ---------- PULSE: status and next steps (Feature 4) ----------
function recordTitle(r) {
  if (r._type === "requests") return r.service_name;
  if (r._type === "appointments") return r.appointment_type;
  if (r._type === "bookings") return r.rooms?.name || "Room booking";
  if (r._type === "borrow_records") return `${r.equipment?.name || "Equipment"}${r.quantity > 1 ? ` × ${r.quantity}` : ""}`;
  return r.title;
}
function statusPill(status) {
  const cls = ["Completed", "Returned", "Accepted", "Approved", "Confirmed", "Ready for pickup", "Borrowed"].includes(status) ? "status-done"
    : ["Declined", "Cancelled"].includes(status) ? "status-stopped"
    : ["In review", "Rescheduled", "Needs revision"].includes(status) ? "status-progress" : "status-waiting";
  const ic = cls === "status-done" ? "check-circle-2" : cls === "status-stopped" ? "circle-slash" : cls === "status-progress" ? "loader" : "hourglass";
  return `<span class="status-pill ${cls}">${icon(ic)} ${escapeHTML(status)}</span>`;
}
/** Plain-language "what happens next" for each status (accurate feedback, no false promises). */
function nextStepText(r) {
  const service = r.service_id ? state.data.services.find((s) => s.id === r.service_id) : null;
  const office = service ? officeByKey(service.office_key) : null;
  const where = office ? `${office.name} (${[buildingName(office.building_key), office.floor_label, office.room_number].filter(Boolean).join(", ")})` : "the office";
  const t = {
    Submitted: `Received. Waiting for ${office ? office.name : "the office"} to review it${service?.processing_time ? ` — usually ${service.processing_time}` : ""}. Nothing else is needed from you yet.`,
    "In review": "The office is reviewing your submission. You'll be notified here when the status changes.",
    Approved: r._type === "borrow_records" ? `Approved. Pick up the item at ${r.equipment?.location || "The Forge"} on ${formatDate(r.pickup_date)}. Bring your student ID.`
      : r._type === "bookings" ? `Approved. Show this booking and your ID at the room on ${formatDate(r.booking_date)}.`
      : "Approved. The office is preparing it. You'll be notified when it's ready.",
    "Ready for pickup": `Ready. Claim it at ${where}${office?.hours ? ` during ${office.hours}` : ""}. Bring your student ID${service?.what_to_bring?.length ? ` and ${service.what_to_bring.join(", ")}` : ""}.`,
    Confirmed: `Confirmed for ${formatDate(r.preferred_date)}, ${r.time_slot}. Arrive 10 minutes early at ${where}.`,
    Rescheduled: "The office proposed a different schedule. Check the note below or contact the office.",
    Borrowed: `Return the item on or before ${formatDate(r.return_date)}.`,
    "Needs revision": "Update your project based on the note below, then submit a new version.",
    Completed: "Done. No further action needed.", Returned: "Returned. Thank you!", Accepted: "Accepted. Congratulations!",
    Declined: "Declined. Read the note from the office or contact them for help.", Cancelled: "You cancelled this. Submit a new one anytime."
  };
  return t[r.status] || "";
}
function renderStepTracker(r) {
  const flow = RECORD_TYPES[r._type].flow;
  const idx = flow.indexOf(r.status === "Rescheduled" ? "Submitted" : r.status === "Needs revision" ? "In review" : r.status);
  if (idx === -1) return "";
  return `<ol class="steps" aria-label="Progress">${flow.map((step, i) => `<li class="${i < idx ? "done" : i === idx ? "done current" : ""}" ${i === idx ? 'aria-current="step"' : ""}>${escapeHTML(step)}</li>`).join("")}</ol>`;
}
function renderRecordCard(r) {
  const details = r._type === "requests" ? r.details
    : r._type === "appointments" ? `${formatDate(r.preferred_date)} · ${r.time_slot}${r.reason ? ` — ${r.reason}` : ""}`
    : r._type === "bookings" ? `${formatDate(r.booking_date)} · ${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)}${r.purpose ? ` — ${r.purpose}` : ""}`
    : r._type === "borrow_records" ? `Pickup ${formatDate(r.pickup_date)} · Return ${formatDate(r.return_date)}${r.purpose ? ` — ${r.purpose}` : ""}`
    : r.description;
  return `
    <article class="record-card">
      <div class="record-head">
        <div><div class="row">${icon(RECORD_TYPES[r._type].icon)}<h3 style="margin:0">${escapeHTML(recordTitle(r))}</h3></div>
          <p class="muted" style="margin:4px 0 0;font-size:.88rem">${RECORD_TYPES[r._type].label} · submitted ${formatDate(r.created_at, true)}${r.building_key ? ` · ${buildingName(r.building_key)}` : ""}</p></div>
        ${statusPill(r.status)}
      </div>
      ${renderStepTracker(r)}
      <div class="next-steps"><strong>What happens next:</strong> ${escapeHTML(nextStepText(r))}</div>
      ${r.staff_note ? `<p style="margin:10px 0 0"><strong>Note from the office:</strong> ${escapeHTML(r.staff_note)}</p>` : ""}
      ${details ? `<p class="muted" style="margin:10px 0 0">${escapeHTML(details)}</p>` : ""}
      ${r._events?.length ? `<details style="margin-top:10px"><summary class="muted">Status history (${r._events.length})</summary>
        <ul class="timeline">${r._events.map((e) => `<li><strong>${escapeHTML(e.status)}</strong> · ${formatDate(e.created_at, true)}${e.note ? ` — ${escapeHTML(e.note)}` : ""}</li>`).join("")}</ul></details>` : ""}
      ${r.status === "Submitted" && r.student_id === state.user.id ? `<div class="dialog-actions"><button class="btn btn-sm btn-danger" type="button" data-action="cancel-record" data-type="${r._type}" data-id="${r.id}">${icon("x-circle")} Cancel</button></div>` : ""}
    </article>`;
}
async function renderPulsePage() {
  const all = (await getMyRecords()).filter((r) => r.student_id === state.user.id);
  const tabs = [["all", "All"], ...Object.entries(RECORD_TYPES).map(([k, v]) => [k, v.label === "Equipment" ? "Equipment" : v.label + "s"])];
  const shown = state.pulseTab === "all" ? all : all.filter((r) => r._type === state.pulseTab);
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("PULSE · My Requests", "Every request, booking and appointment you've submitted, with its current status and what happens next.", `${icon("activity")} Status & next steps`)}
    <div class="tabs" role="tablist">${tabs.map(([k, label]) => `<button class="tab" role="tab" type="button" data-action="pulse-tab" data-tab="${k}" aria-selected="${state.pulseTab === k}">${label} (${k === "all" ? all.length : all.filter((r) => r._type === k).length})</button>`).join("")}</div>
    ${shown.length ? `<div class="grid">${shown.map(renderRecordCard).join("")}</div>`
      : renderEmptyState("Nothing here yet", "Open any service and use its button to submit a request, book a room or set an appointment.", "inbox", `<button class="btn btn-primary" type="button" data-section="finder">${icon("search")} Find a service</button>`)}`;
}

// ---------- Innovation Hub ----------
async function renderInnovationPage() {
  const [equipment, records] = await Promise.all([getEquipmentWithAvailability(), getMyRecords()]);
  const mine = records.filter((r) => r.student_id === state.user.id);
  const borrows = mine.filter((r) => r._type === "borrow_records");
  const projects = mine.filter((r) => r._type === "projects");
  const hereItems = equipment.filter((e) => e.building_key === state.building);
  const elsewhere = equipment.filter((e) => e.building_key !== state.building);
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Innovation Hub", "Borrow maker equipment from The Forge and submit project ideas.", `${icon("lightbulb")} Make & build`,
      `<button class="btn btn-primary" type="button" data-action="open-project-form">${icon("plus")} Submit a project</button>`)}
    ${!hereItems.length && elsewhere.length ? `<div class="notice" style="margin-bottom:16px">${icon("building")} <span>Equipment borrowing isn't offered in ${buildingName()}. Items are picked up at <strong>${escapeHTML(elsewhere[0].location || buildingName(otherBuilding()))}</strong> in ${buildingName(otherBuilding())}.</span></div>` : ""}
    <h2>Equipment</h2>
    ${equipment.length ? `<div class="grid grid-auto">${[...hereItems, ...elsewhere].map((e) => `
      <article class="card ${neonClass(e.name)}">
        <div class="row"><span class="service-icon">${icon(e.icon_name)}</span><div><h3 style="margin:0">${escapeHTML(e.name)}</h3>
          <span class="muted" style="font-size:.86rem">${escapeHTML(buildingName(e.building_key))}</span></div></div>
        <p class="muted" style="margin:10px 0">${escapeHTML(e.description || "")}</p>
        <div class="service-meta"><span>${icon("map-pin")} ${escapeHTML(e.location || "Location to be added")}</span>
          <span>${icon("package-check")} ${e.available === null ? "Availability unknown" : `${e.available} of ${e.total_quantity} available`}</span></div>
        <div class="row" style="margin-top:10px">${e.is_hypothetical ? '<span class="badge badge-sample">Sample data</span>' : ""}<span class="spacer"></span>
          <button class="btn btn-sm btn-primary" type="button" data-action="open-borrow-form" data-id="${e.id}" ${e.available === 0 ? "disabled" : ""}>${e.available === 0 ? "None available" : `${icon("hand")} Borrow`}</button></div>
      </article>`).join("")}</div>` : renderEmptyState("No equipment listed", "The Forge hasn't added equipment yet.", "package")}
    <div class="grid grid-2 section">
      <section><h2>My borrowing</h2>${borrows.length ? `<div class="grid">${borrows.map(renderRecordCard).join("")}</div>` : renderEmptyState("No borrowing requests", "Choose an item above to borrow it.", "package")}</section>
      <section><h2>My projects</h2>${projects.length ? `<div class="grid">${projects.map(renderRecordCard).join("")}</div>` : renderEmptyState("No projects submitted", "Have an idea or a finished project? Submit it for review.", "lightbulb")}</section>
    </div>`;
}

async function renderHandbookPage() {
  const docs = await getDocuments();
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("College Handbook", "The student handbook and official memoranda.", `${icon("book-open")} Policies`)}
    ${docs.length ? `<div class="grid">${docs.map((d) => {
      const url = safeUrl(d.document_url);
      return `<article class="card row"><span class="service-icon">${icon("file-text")}</span>
        <div style="flex:1"><h3 style="margin:0">${escapeHTML(d.title)}</h3><p class="muted" style="margin:2px 0 0">${escapeHTML(d.description || "")} · ${formatDate(d.published_at)}</p></div>
        ${url ? `<a class="btn btn-sm" href="${escapeHTML(url)}" target="_blank" rel="noopener">${icon("external-link")} Open</a>` : '<span class="badge">File not yet uploaded</span>'}</article>`;
    }).join("")}</div>` : renderEmptyState("No documents yet", "Handbook documents haven't been added.", "book-open")}`;
}

function renderSettingsPage() {
  const p = state.profile || {};
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Settings", "Your profile and display preferences.", `${icon("settings")} Preferences`)}
    <div class="grid grid-2">
      <form class="card" data-form="profile">
        <h2>Profile</h2>
        <p class="muted">Used to personalize Quick Access.</p>
        <div class="field"><label for="pName">Name</label><input id="pName" name="full_name" type="text" value="${escapeHTML(p.full_name || "")}" required></div>
        <div class="form-row">
          <div class="field"><label for="pProgram">Program</label><select id="pProgram" name="program"><option value="">Choose…</option>
            ${["Tech", "Arts", "Entrepreneurship"].map((x) => `<option ${p.program === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="field"><label for="pYear">Year level</label><select id="pYear" name="year_level"><option value="">Choose…</option>
            ${[1, 2, 3, 4].map((y) => `<option value="${y}" ${p.year_level === y ? "selected" : ""}>${y}${["st", "nd", "rd", "th"][y - 1]} year</option>`).join("")}</select></div>
        </div>
        <p class="muted" style="font-size:.88rem">Signed in as ${escapeHTML(state.user.email)} · Role: ${escapeHTML(p.role || "student")}</p>
        <button class="btn btn-primary" type="submit">Save profile</button>
      </form>
      <section class="card">
        <h2>Display</h2>
        <div class="field"><label for="textSize">Text size</label>
          <select id="textSize" data-setting="text-size">${[["15px", "Small"], ["16px", "Default"], ["18px", "Large"], ["20px", "Extra large"]].map(([v, l]) => `<option value="${v}" ${state.textSize === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <label class="checkbox-row"><input type="checkbox" data-setting="high-contrast" ${state.highContrast ? "checked" : ""}> High contrast</label>
        <p class="form-help">Building colours: Interweave uses CIIT navy and white; Glitch Tower uses charcoal with neon accents. The building name is always shown, so colour is never the only cue.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:18px 0">
        <button class="btn btn-danger" type="button" data-action="sign-out">${icon("log-out")} Sign out</button>
      </section>
    </div>`;
}

// ---------- Staff tools: update statuses + maintain service/office details ----------
async function renderStaffPage() {
  const tabs = [["records", "Requests & bookings"], ["services", "Service details"], ["offices", "Office details"]];
  let body = "";
  if (state.staffTab === "records") {
    const [records, profiles] = await Promise.all([getMyRecords(), supabaseClient.from("profiles").select("id, full_name, program, year_level")]);
    const people = Object.fromEntries((profiles.data || []).map((p) => [p.id, p]));
    const open = records.filter((r) => !["Completed", "Returned", "Declined", "Cancelled", "Accepted"].includes(r.status));
    body = open.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Submitted</th><th>Student</th><th>Type</th><th>Item</th><th>Details</th><th>Status & note</th></tr></thead>
      <tbody>${open.map((r) => `<tr>
        <td>${formatDate(r.created_at, true)}</td>
        <td>${escapeHTML(people[r.student_id]?.full_name || "Student")}<br><small class="muted">${escapeHTML([people[r.student_id]?.program, people[r.student_id]?.year_level ? `Year ${people[r.student_id].year_level}` : ""].filter(Boolean).join(" · "))}</small></td>
        <td>${RECORD_TYPES[r._type].label}</td>
        <td><strong>${escapeHTML(recordTitle(r))}</strong></td>
        <td style="max-width:260px">${escapeHTML(r.details || r.reason || r.purpose || r.description || "")}${r.preferred_date ? `<br><small>${formatDate(r.preferred_date)} · ${escapeHTML(r.time_slot)}</small>` : ""}${r.booking_date ? `<br><small>${formatDate(r.booking_date)} · ${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)}</small>` : ""}</td>
        <td><form class="grid" style="gap:6px;min-width:220px" data-form="staff-status" data-type="${r._type}" data-id="${r.id}">
          <label class="sr-only" for="st-${r.id}">Status</label>
          <select id="st-${r.id}" name="status">${ALL_STATUSES[r._type].map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <label class="sr-only" for="sn-${r.id}">Note to student</label>
          <input id="sn-${r.id}" name="staff_note" type="text" placeholder="Note to student (optional)" value="${escapeHTML(r.staff_note || "")}">
          <button class="btn btn-sm btn-primary" type="submit">Update</button></form></td>
      </tr>`).join("")}</tbody></table></div>`
      : renderEmptyState("No open records", "New requests, bookings and appointments from students will appear here.", "inbox");
  } else if (state.staffTab === "services") {
    const list = servicesIn().filter((s) => s.service_type !== "Online" || !s.website_url);
    body = `<p class="muted">Keeping these details accurate is what makes the finder trustworthy. Tick <strong>Verified</strong> once confirmed with the office; the "Sample details" badge then disappears.</p>
      <div class="table-wrap"><table><thead><tr><th>Service (${buildingName()})</th><th>Location</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((s) => `<tr><td><strong>${escapeHTML(s.name)}</strong><br><small class="muted">${escapeHTML(s.category)}</small></td><td>${escapeHTML(locationLine(s))}</td><td>${escapeHTML(s.hours || "—")}</td>
        <td>${s.details_verified ? '<span class="badge badge-ok">Verified</span>' : '<span class="badge badge-sample">Sample</span>'}</td>
        <td><button class="btn btn-sm" type="button" data-action="edit-service" data-id="${s.id}">${icon("pencil")} Edit</button></td></tr>`).join("")}
      </tbody></table></div>`;
  } else {
    body = `<div class="table-wrap"><table><thead><tr><th>Office</th><th>Location</th><th>Hours</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>
      ${state.data.offices.map((o) => `<tr><td><strong>${escapeHTML(o.name)}</strong><br><small class="muted">${buildingName(o.building_key)}</small></td><td>${escapeHTML([o.floor_label, o.room_number].filter(Boolean).join(" · ") || "—")}</td>
        <td>${escapeHTML(o.hours || "—")}</td><td>${escapeHTML(o.email || "—")}</td><td>${o.details_verified ? '<span class="badge badge-ok">Verified</span>' : '<span class="badge badge-sample">Sample</span>'}</td>
        <td><button class="btn btn-sm" type="button" data-action="edit-office" data-id="${o.id}">${icon("pencil")} Edit</button></td></tr>`).join("")}
      </tbody></table></div>`;
  }
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Staff Tools", "Update request statuses (students are notified automatically) and keep service and office details current.", `${icon("shield-check")} Staff only`)}
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" type="button" data-action="staff-tab" data-tab="${k}" aria-selected="${state.staffTab === k}">${l}</button>`).join("")}</div>
    ${body}`;
}

// =========================================================
// 9. SERVICE CARDS + DETAIL DIALOG (Feature 1: finder)
// =========================================================
function serviceBadges(s) {
  const b = [];
  if (s.service_type === "Online") b.push(`<span class="badge badge-info">${icon("globe")} Online</span>`);
  if (s.building_key !== state.building) b.push(`<span class="badge badge-building">${icon(BUILDINGS[s.building_key].icon)} ${buildingName(s.building_key)}</span>`);
  else if (s.service_type !== "Online" && serviceByCode(s.service_code, otherBuilding())) b.push(`<span class="badge">Also at ${buildingName(otherBuilding())}</span>`);
  if (s.is_hypothetical) b.push(`<span class="badge badge-sample">${icon("flask-conical")} Sample service</span>`);
  else if (!s.details_verified && s.service_type !== "Online") b.push('<span class="badge badge-sample">Sample details</span>');
  return b.join("");
}
function renderServiceCard(s) {
  return `
    <button class="service-card ${neonClass(s.name)}" type="button" data-action="open-service" data-id="${s.id}">
      <div class="service-card-top">
        <span class="service-icon">${icon(s.icon_name)}</span>
        <div><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.description || "")}</p></div>
      </div>
      <div class="service-meta">
        <span>${icon(s.service_type === "Online" ? "globe" : "map-pin")} ${escapeHTML(locationLine(s))}</span>
        ${s.hours ? `<span>${icon("clock")} ${escapeHTML(s.hours)}</span>` : ""}
      </div>
      <div class="badges">${serviceBadges(s)}</div>
    </button>`;
}

const ACTION_BUTTONS = {
  request: ["open-request-form", "send", "Start request"],
  appointment: ["open-appointment-form", "calendar-plus", "Request appointment"],
  booking: ["open-booking-form", "calendar-plus", "Book a room"],
  borrow: ["go-innovation", "hand", "Borrow equipment"]
};
function openServiceDialog(id) {
  const s = state.data.services.find((x) => x.id === id);
  if (!s) return;
  const office = officeByKey(s.office_key);
  const twin = serviceByCode(s.service_code, otherBuilding(s.building_key));
  const url = safeUrl(s.website_url);
  const list = (items) => items?.length ? `<ul>${items.map((i) => `<li>${escapeHTML(i)}</li>`).join("")}</ul>` : '<span class="muted">None listed</span>';
  let actionBtn = "";
  if (ACTION_BUTTONS[s.action_type]) {
    const [action, ic, label] = ACTION_BUTTONS[s.action_type];
    actionBtn = `<button class="btn btn-primary" type="button" data-action="${action}" data-id="${s.id}">${icon(ic)} ${label}</button>`;
  } else if (s.action_type === "link") {
    actionBtn = url ? `<a class="btn btn-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener">${icon("external-link")} Open ${escapeHTML(s.name)}</a>`
      : `<button class="btn" type="button" disabled>${icon("link-2-off")} Link not added yet</button>`;
  }
  const crossNote = s.building_key !== state.building
    ? `<div class="notice" style="margin-bottom:12px">${icon("building")} <span>This service is at <strong>${buildingName(s.building_key)}</strong>, not ${buildingName()}.
        <button class="btn btn-sm" type="button" data-action="switch-building" data-building="${s.building_key}">Switch to ${buildingName(s.building_key)}</button></span></div>`
    : twin && s.service_type !== "Online" ? `<div class="notice" style="margin-bottom:12px">${icon("building-2")} <span>Also available at <strong>${buildingName(twin.building_key)}</strong> — ${escapeHTML(locationLine(twin))}.</span></div>` : "";

  showDialog(s.name, `
    ${crossNote}
    <div class="badges">${serviceBadges(s)}<span class="badge">${escapeHTML(s.category)}</span></div>
    <p style="margin-top:12px">${escapeHTML(s.description || "")}</p>
    <div class="detail-grid">
      <div class="detail-item"><div class="label">${icon("map-pin")} Where</div>${escapeHTML(locationLine(s))}</div>
      <div class="detail-item"><div class="label">${icon("clock")} Hours</div>${escapeHTML(s.hours || office?.hours || "Not yet added")}</div>
      <div class="detail-item"><div class="label">${icon("clipboard-list")} Requirements</div>${list(s.requirements)}</div>
      <div class="detail-item"><div class="label">${icon("backpack")} What to bring</div>${list(s.what_to_bring)}</div>
      ${s.processing_time ? `<div class="detail-item"><div class="label">${icon("timer")} Processing time</div>${escapeHTML(s.processing_time)}</div>` : ""}
      ${office ? `<div class="detail-item"><div class="label">${icon("contact")} Contact</div><strong>${escapeHTML(office.name)}</strong><br>
        ${office.email ? `<a href="mailto:${escapeHTML(office.email)}">${escapeHTML(office.email)}</a><br>` : ""}<small class="muted">${escapeHTML([buildingName(office.building_key), office.floor_label, office.room_number].filter(Boolean).join(" · "))}</small></div>` : ""}
    </div>
    ${s.next_steps ? `<div class="next-steps"><strong>Next step:</strong> ${escapeHTML(s.next_steps)}</div>` : ""}
    ${(s.is_hypothetical || (!s.details_verified && s.service_type !== "Online")) ? `<p class="form-help" style="margin-top:10px">${icon("flask-conical")} Some details are sample data for the prototype and haven't been verified with CIIT.</p>` : ""}
    <div class="dialog-actions">
      <button class="btn" type="button" data-action="toggle-pin" data-code="${escapeHTML(s.service_code)}">${icon("pin")} ${state.shortcutPrefs[s.service_code]?.is_pinned ? "Unpin from" : "Pin to"} Quick access</button>
      ${actionBtn}
    </div>`, { wide: true });
}

// =========================================================
// 10. FORMS
// =========================================================
/** Request form with a review step before submitting (proposal: "reviews it before submitting"). */
function openRequestForm(serviceId) {
  const s = state.data.services.find((x) => x.id === serviceId);
  showDialog(`Request: ${s.name}`, `
    <form data-form="request" data-id="${s.id}" novalidate>
      <div class="notice" style="margin-bottom:12px">${icon("info")} <span>Requirements: ${escapeHTML((s.requirements || []).join("; ") || "none listed")}.</span></div>
      <div class="field"><label for="reqDetails">Details for the office</label>
        <textarea id="reqDetails" name="details" required placeholder="e.g. 2 copies of my TOR for a scholarship application"></textarea>
        <small>Say what you need, how many, and why.</small></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">Review request ${icon("arrow-right")}</button></div>
    </form>`, { description: `${buildingName(s.building_key)} · ${s.processing_time || "Processing time not listed"}` });
}
function showRequestReview(s, details) {
  const office = officeByKey(s.office_key);
  showDialog("Review your request", `
    <dl class="detail-grid">
      <div class="detail-item"><div class="label">Service</div>${escapeHTML(s.name)}</div>
      <div class="detail-item"><div class="label">Building</div>${buildingName(s.building_key)}</div>
      <div class="detail-item" style="grid-column:1/-1"><div class="label">Details</div>${escapeHTML(details)}</div>
      <div class="detail-item"><div class="label">Handled by</div>${escapeHTML(office?.name || "The office")}</div>
      <div class="detail-item"><div class="label">Usually takes</div>${escapeHTML(s.processing_time || "Not listed")}</div>
    </dl>
    <p class="form-help">After you submit, the status starts at <strong>Submitted</strong>. Only the office can change it. You can cancel while it's still Submitted.</p>
    <div class="dialog-actions"><button class="btn" type="button" data-action="edit-request" data-id="${s.id}">${icon("arrow-left")} Edit</button>
      <button class="btn btn-primary" type="button" data-action="confirm-request" data-id="${s.id}">${icon("send")} Submit request</button></div>`);
  state.pendingRequest = { serviceId: s.id, details };
}
async function submitRequest() {
  const { serviceId, details } = state.pendingRequest || {};
  const s = state.data.services.find((x) => x.id === serviceId);
  const { error } = await supabaseClient.from("requests").insert({ service_id: s.id, service_name: s.name, building_key: s.building_key, details });
  if (error) return showToast("We couldn't submit your request. Please try again.", true);
  state.pendingRequest = null;
  closeDialog();
  showToast("Request received. Waiting for the office to review it.");
  navigateTo("pulse");
}

function openAppointmentForm(serviceId) {
  const s = state.data.services.find((x) => x.id === serviceId);
  showDialog(s.name, `
    <form data-form="appointment" data-id="${s.id}" novalidate>
      <div class="form-row">
        <div class="field"><label for="apDate">Preferred date</label><input id="apDate" name="preferred_date" type="date" min="${todayString()}" required></div>
        <div class="field"><label for="apSlot">Preferred time</label><select id="apSlot" name="time_slot" required>${TIME_SLOTS.map((t) => `<option>${t}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="apReason">Reason (optional)</label><textarea id="apReason" name="reason" placeholder="Briefly describe your concern"></textarea>
        <small>${s.service_code === "guidance-appointment-scheduler" ? "Only the Guidance office sees this. If you need help right now, go to the Guidance & Counseling Center or call your local crisis hotline." : "Only the office handling your appointment sees this."}</small></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("calendar-plus")} Request appointment</button></div>
    </form>`, { description: `${buildingName(s.building_key)} · ${s.hours || ""}` });
}
async function submitAppointment(form) {
  const s = state.data.services.find((x) => x.id === form.dataset.id);
  const f = form.elements;
  if (!f.preferred_date.value || f.preferred_date.value < todayString()) return (document.getElementById("formError").textContent = "Choose today or a future date.");
  const { error } = await supabaseClient.from("appointments").insert({
    service_id: s.id, appointment_type: s.name, building_key: s.building_key,
    preferred_date: f.preferred_date.value, time_slot: f.time_slot.value, reason: f.reason.value.trim() || null
  });
  if (error) return showToast("We couldn't send your appointment request. Please try again.", true);
  closeDialog(); showToast("Appointment request received. The office will confirm your slot."); navigateTo("pulse");
}

async function openBookingForm(roomId = null) {
  const rooms = await getBookableRooms();
  const here = rooms.filter((r) => r.building_key === state.building);
  const there = rooms.filter((r) => r.building_key !== state.building);
  const opt = (r) => `<option value="${r.id}" ${r.id === roomId ? "selected" : ""}>${escapeHTML(r.name)}${r.capacity ? ` (up to ${r.capacity})` : ""}</option>`;
  showDialog("Book a space", `
    <form data-form="booking" novalidate>
      <div class="field"><label for="bkRoom">Room</label><select id="bkRoom" name="room_id" required>
        <optgroup label="${buildingName()}">${here.map(opt).join("")}</optgroup>
        ${there.length ? `<optgroup label="${buildingName(otherBuilding())}">${there.map(opt).join("")}</optgroup>` : ""}</select></div>
      <div class="field"><label for="bkDate">Date</label><input id="bkDate" name="booking_date" type="date" min="${todayString()}" required></div>
      <div class="form-row">
        <div class="field"><label for="bkStart">Start</label><input id="bkStart" name="start_time" type="time" min="07:00" max="21:00" step="1800" required></div>
        <div class="field"><label for="bkEnd">End</label><input id="bkEnd" name="end_time" type="time" min="07:00" max="21:00" step="1800" required></div>
      </div>
      <div class="field"><label for="bkPurpose">Purpose</label><input id="bkPurpose" name="purpose" type="text" placeholder="e.g. Group thesis meeting" required></div>
      <p class="form-help">Rooms open 7:00 AM – 9:00 PM. Maximum 3 hours. We check for conflicts before sending.</p>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("calendar-plus")} Send booking request</button></div>
    </form>`);
}
async function submitBooking(form) {
  const f = form.elements; const err = document.getElementById("formError");
  const [sh, sm] = f.start_time.value.split(":").map(Number); const [eh, em] = f.end_time.value.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (!f.booking_date.value || f.booking_date.value < todayString()) return (err.textContent = "Choose today or a future date.");
  if (!f.start_time.value || !f.end_time.value || minutes <= 0) return (err.textContent = "End time must be after start time.");
  if (minutes > 180) return (err.textContent = "Bookings can be at most 3 hours.");
  if (!f.purpose.value.trim()) return (err.textContent = "Tell the office what the room is for.");
  const free = await supabaseClient.rpc("room_is_free", { p_room_id: f.room_id.value, p_date: f.booking_date.value, p_start: f.start_time.value, p_end: f.end_time.value });
  if (free.error) return showToast("We couldn't check room availability. Please try again.", true);
  if (!free.data) return (err.textContent = "That room is already requested or booked at that time. Try another time or room.");
  const { error } = await supabaseClient.from("bookings").insert({ room_id: f.room_id.value, booking_date: f.booking_date.value, start_time: f.start_time.value, end_time: f.end_time.value, purpose: f.purpose.value.trim() });
  if (error) return showToast("We couldn't send your booking. Please try again.", true);
  closeDialog(); showToast("Booking request received. Facilities will approve or decline it."); navigateTo("pulse");
}

async function openBorrowForm(equipmentId) {
  const items = await getEquipmentWithAvailability();
  const e = items.find((x) => x.id === equipmentId);
  showDialog(`Borrow: ${e.name}`, `
    <form data-form="borrow" data-id="${e.id}" novalidate>
      <div class="notice" style="margin-bottom:12px">${icon("map-pin")} <span>Pick up at <strong>${escapeHTML(e.location || buildingName(e.building_key))}</strong>. ${e.available} available now.</span></div>
      <div class="field"><label for="brQty">Quantity</label><input id="brQty" name="quantity" type="number" min="1" max="${Math.max(1, e.available)}" value="1" required></div>
      <div class="form-row">
        <div class="field"><label for="brPick">Pickup date</label><input id="brPick" name="pickup_date" type="date" min="${todayString()}" required></div>
        <div class="field"><label for="brRet">Return date</label><input id="brRet" name="return_date" type="date" min="${todayString()}" required></div>
      </div>
      <div class="field"><label for="brPurpose">Purpose</label><input id="brPurpose" name="purpose" type="text" placeholder="e.g. Capstone prototype testing" required></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("hand")} Send borrowing request</button></div>
    </form>`);
  state.borrowMax = e.available;
}
async function submitBorrow(form) {
  const f = form.elements; const err = document.getElementById("formError");
  const qty = Number(f.quantity.value);
  if (!qty || qty < 1 || qty > state.borrowMax) return (err.textContent = `Choose between 1 and ${state.borrowMax}.`);
  if (!f.pickup_date.value || f.pickup_date.value < todayString()) return (err.textContent = "Choose today or a future pickup date.");
  if (!f.return_date.value || f.return_date.value < f.pickup_date.value) return (err.textContent = "Return date can't be before the pickup date.");
  if (!f.purpose.value.trim()) return (err.textContent = "Add a short purpose.");
  const { error } = await supabaseClient.from("borrow_records").insert({ equipment_id: form.dataset.id, quantity: qty, pickup_date: f.pickup_date.value, return_date: f.return_date.value, purpose: f.purpose.value.trim() });
  if (error) return showToast("We couldn't send your borrowing request. Please try again.", true);
  closeDialog(); showToast("Borrowing request received. Wait for approval before pickup."); renderCurrentPage();
}

function openProjectForm() {
  showDialog("Submit a project", `
    <form data-form="project" novalidate>
      <div class="field"><label for="prTitle">Project title</label><input id="prTitle" name="title" type="text" required></div>
      <div class="field"><label for="prType">Type</label><select id="prType" name="project_type">${["Idea / proposal", "Game", "App or website", "Hardware / maker", "Film or animation", "Other"].map((t) => `<option>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="prDesc">Description</label><textarea id="prDesc" name="description" required></textarea></div>
      <div class="field"><label for="prTeam">Team members (optional)</label><input id="prTeam" name="team_members" type="text" placeholder="Names, separated by commas"></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("send")} Submit project</button></div>
    </form>`);
}
async function submitProject(form) {
  const f = form.elements;
  if (!f.title.value.trim() || !f.description.value.trim()) return (document.getElementById("formError").textContent = "Add a title and description.");
  const { error } = await supabaseClient.from("projects").insert({ title: f.title.value.trim(), project_type: f.project_type.value, description: f.description.value.trim(), team_members: f.team_members.value.trim() || null });
  if (error) return showToast("We couldn't submit your project. Please try again.", true);
  closeDialog(); showToast("Project submitted for review."); renderCurrentPage();
}

async function saveProfile(form) {
  const f = form.elements;
  const update = { full_name: f.full_name.value.trim(), program: f.program.value || null, year_level: f.year_level.value ? Number(f.year_level.value) : null };
  const { data, error } = await supabaseClient.from("profiles").update(update).eq("id", state.user.id).select().single();
  if (error) return showToast("We couldn't save your profile.", true);
  state.profile = data; closeDialog(); showToast("Profile saved. Quick access updated."); renderAppShell(); renderCurrentPage();
}
function openProfileDialog() {
  const p = state.profile || {};
  showDialog("Your program and year", `
    <form data-form="profile">
      <input type="hidden" name="full_name" value="${escapeHTML(p.full_name || state.user.email.split("@")[0])}">
      <div class="form-row">
        <div class="field"><label for="dProgram">Program</label><select id="dProgram" name="program" required><option value="">Choose…</option>${["Tech", "Arts", "Entrepreneurship"].map((x) => `<option ${p.program === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label for="dYear">Year level</label><select id="dYear" name="year_level" required><option value="">Choose…</option>${[1, 2, 3, 4].map((y) => `<option value="${y}" ${p.year_level === y ? "selected" : ""}>${y}</option>`).join("")}</select></div>
      </div>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Later</button><button class="btn btn-primary" type="submit">Save</button></div>
    </form>`);
}

/** Customize Quick access: pin or hide any service in this building. */
function openShortcutEditor() {
  const list = servicesIn().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  showDialog("Customize Quick access", `
    <p class="muted">Pinned services always appear first. Hidden ones never appear. Others are suggested from your program and year.</p>
    <div class="table-wrap" style="max-height:420px;overflow:auto"><table><thead><tr><th>Service</th><th>Pin</th><th>Hide</th></tr></thead><tbody>
      ${list.map((s) => { const p = state.shortcutPrefs[s.service_code] || {}; return `<tr><td>${escapeHTML(s.name)}<br><small class="muted">${escapeHTML(s.category)}</small></td>
        <td><input type="checkbox" aria-label="Pin ${escapeHTML(s.name)}" data-pref="pin" data-code="${escapeHTML(s.service_code)}" ${p.is_pinned ? "checked" : ""}></td>
        <td><input type="checkbox" aria-label="Hide ${escapeHTML(s.name)}" data-pref="hide" data-code="${escapeHTML(s.service_code)}" ${p.is_hidden ? "checked" : ""}></td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="dialog-actions"><button class="btn btn-primary" type="button" data-action="close-and-refresh">Done</button></div>`, { wide: true });
}
async function saveShortcutPref(code, changes) {
  const current = state.shortcutPrefs[code] || { service_code: code, is_pinned: false, is_hidden: false };
  const next = { ...current, ...changes, service_code: code };
  if (changes.is_pinned) next.is_hidden = false;
  if (changes.is_hidden) next.is_pinned = false;
  const { error } = await supabaseClient.from("shortcut_preferences").upsert({ student_id: state.user.id, service_code: code, is_pinned: next.is_pinned, is_hidden: next.is_hidden });
  if (error) return showToast("We couldn't save that shortcut.", true);
  state.shortcutPrefs[code] = next;
}

function openServiceEditor(id) {
  const s = state.data.services.find((x) => x.id === id);
  showDialog(`Edit: ${s.name}`, `
    <form data-form="staff-service" data-id="${s.id}">
      <div class="form-row">
        <div class="field"><label for="esFloor">Floor</label><input id="esFloor" name="floor_label" type="text" value="${escapeHTML(s.floor_label || "")}"></div>
        <div class="field"><label for="esRoom">Room / area</label><input id="esRoom" name="room_number" type="text" value="${escapeHTML(s.room_number || "")}"></div>
      </div>
      <div class="field"><label for="esHours">Hours</label><input id="esHours" name="hours" type="text" value="${escapeHTML(s.hours || "")}"></div>
      <div class="field"><label for="esReq">Requirements (one per line)</label><textarea id="esReq" name="requirements">${escapeHTML((s.requirements || []).join("\n"))}</textarea></div>
      <div class="field"><label for="esBring">What to bring (one per line)</label><textarea id="esBring" name="what_to_bring">${escapeHTML((s.what_to_bring || []).join("\n"))}</textarea></div>
      <div class="form-row">
        <div class="field"><label for="esProc">Processing time</label><input id="esProc" name="processing_time" type="text" value="${escapeHTML(s.processing_time || "")}"></div>
        <div class="field"><label for="esUrl">Link (https)</label><input id="esUrl" name="website_url" type="text" value="${escapeHTML(s.website_url || "")}"></div>
      </div>
      <div class="field"><label for="esNext">Next step for students</label><textarea id="esNext" name="next_steps">${escapeHTML(s.next_steps || "")}</textarea></div>
      <label class="checkbox-row"><input type="checkbox" name="details_verified" ${s.details_verified ? "checked" : ""}> Verified with the office</label>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div>
    </form>`, { wide: true, description: `${buildingName(s.building_key)} · ${s.category}` });
}
function openOfficeEditor(id) {
  const o = state.data.offices.find((x) => x.id === id);
  showDialog(`Edit: ${o.name}`, `
    <form data-form="staff-office" data-id="${o.id}">
      <div class="form-row">
        <div class="field"><label for="eoFloor">Floor</label><input id="eoFloor" name="floor_label" type="text" value="${escapeHTML(o.floor_label || "")}"></div>
        <div class="field"><label for="eoRoom">Room</label><input id="eoRoom" name="room_number" type="text" value="${escapeHTML(o.room_number || "")}"></div>
      </div>
      <div class="field"><label for="eoHours">Hours</label><input id="eoHours" name="hours" type="text" value="${escapeHTML(o.hours || "")}"></div>
      <div class="field"><label for="eoBring">What to bring</label><input id="eoBring" name="what_to_bring" type="text" value="${escapeHTML(o.what_to_bring || "")}"></div>
      <div class="field"><label for="eoEmail">Email</label><input id="eoEmail" name="email" type="email" value="${escapeHTML(o.email || "")}"></div>
      <label class="checkbox-row"><input type="checkbox" name="details_verified" ${o.details_verified ? "checked" : ""}> Verified with the office</label>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div>
    </form>`);
}
const lines = (v) => v.split("\n").map((x) => x.trim()).filter(Boolean);
async function saveStaffForm(form) {
  const f = form.elements;
  const isService = form.dataset.form === "staff-service";
  const update = isService ? {
    floor_label: f.floor_label.value.trim() || null, room_number: f.room_number.value.trim() || null, hours: f.hours.value.trim() || null,
    requirements: lines(f.requirements.value), what_to_bring: lines(f.what_to_bring.value), processing_time: f.processing_time.value.trim() || null,
    website_url: safeUrl(f.website_url.value.trim()) || null, next_steps: f.next_steps.value.trim() || null, details_verified: f.details_verified.checked
  } : {
    floor_label: f.floor_label.value.trim() || null, room_number: f.room_number.value.trim() || null, hours: f.hours.value.trim() || null,
    what_to_bring: f.what_to_bring.value.trim() || null, email: f.email.value.trim() || null, details_verified: f.details_verified.checked
  };
  const { error } = await supabaseClient.from(isService ? "services" : "offices").update(update).eq("id", form.dataset.id);
  if (error) return showToast("Save failed. Only staff accounts can edit this.", true);
  await loadSharedData(true);
  closeDialog(); showToast("Saved. Students see the update right away."); renderCurrentPage();
}
async function saveStaffStatus(form) {
  const { error } = await supabaseClient.from(form.dataset.type).update({ status: form.elements.status.value, staff_note: form.elements.staff_note.value.trim() || null }).eq("id", form.dataset.id);
  if (error) return showToast("Couldn't update the status.", true);
  showToast("Status updated. The student has been notified."); renderCurrentPage();
}

async function openNotifications() {
  let items = [];
  try { items = await getNotifications(); } catch { return showToast("Couldn't load notifications.", true); }
  showDialog("Notifications", items.length ? `
    <div class="dialog-actions" style="margin-top:0"><button class="btn btn-sm" type="button" data-action="mark-all-read">${icon("check-check")} Mark all as read</button></div>
    ${items.map((n) => `<div class="announcement"><div class="row">${n.is_read ? "" : '<span class="badge badge-info">New</span>'}<strong>${escapeHTML(n.title)}</strong></div>
      <p class="muted" style="margin:4px 0">${escapeHTML(n.body || "")}</p><small class="muted">${formatDate(n.created_at, true)}</small>
      ${n.link_section ? ` · <button class="btn btn-sm btn-ghost" type="button" data-action="notif-go" data-section-target="${escapeHTML(n.link_section)}">View</button>` : ""}</div>`).join("")}`
    : renderEmptyState("No notifications", "When an office updates one of your requests, you'll see it here.", "bell"));
}

function openProfileMenu(anchor) {
  const existing = document.getElementById("profileMenu");
  if (existing) { existing.remove(); return; }
  const menu = document.createElement("div");
  menu.id = "profileMenu"; menu.className = "menu-popover"; menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <p style="padding:6px 10px;margin:0"><strong>${escapeHTML(state.profile?.full_name || "")}</strong><br><small class="muted">${escapeHTML(state.user.email)}</small></p>
    <button class="btn btn-ghost" role="menuitem" type="button" data-section="settings">${icon("settings")} Settings</button>
    <button class="btn btn-ghost" role="menuitem" type="button" data-section="pulse">${icon("activity")} My requests</button>
    <button class="btn btn-ghost" role="menuitem" type="button" data-action="sign-out">${icon("log-out")} Sign out</button>`;
  document.body.appendChild(menu);
  refreshIcons();
  menu.querySelector("button").focus();
}

// =========================================================
// 11. EVENT HANDLING + START-UP
// =========================================================
async function handleClick(event) {
  const target = event.target.closest("[data-action], [data-section], [data-building-key]");
  if (!target) { document.getElementById("profileMenu")?.remove(); return; }
  if (!target.closest("#profileMenu") && target.dataset.action !== "open-profile-menu") document.getElementById("profileMenu")?.remove();

  if (target.dataset.buildingKey) return setBuilding(target.dataset.buildingKey);
  if (target.dataset.section && !target.dataset.action) { closeDialog(); return navigateTo(target.dataset.section); }

  const { action, id } = target.dataset;
  switch (action) {
    case "close-dialog": return closeDialog();
    case "close-dialog-backdrop": if (event.target === target) closeDialog(); return;
    case "close-and-refresh": closeDialog(); return renderCurrentPage();
    case "retry": state.data.loaded = false; try { await loadSharedData(); } catch (e) { return showPageError(e); } return renderCurrentPage();
    case "sign-out": return signOut();
    case "open-service": return openServiceDialog(id);
    case "switch-building": closeDialog(); return setBuilding(target.dataset.building);
    case "open-request-form": return openRequestForm(id);
    case "edit-request": return openRequestForm(id);
    case "confirm-request": return submitRequest();
    case "open-appointment-form": return openAppointmentForm(id);
    case "open-booking-form": try { return await openBookingForm(target.dataset.room || null); } catch { return showToast("Couldn't load rooms. Try again.", true); }
    case "open-borrow-form": try { return await openBorrowForm(id); } catch { return showToast("Couldn't load equipment. Try again.", true); }
    case "go-innovation": closeDialog(); return navigateTo("innovation");
    case "open-project-form": return openProjectForm();
    case "edit-profile": return openProfileDialog();
    case "edit-shortcuts": return openShortcutEditor();
    case "toggle-pin": {
      const code = target.dataset.code;
      await saveShortcutPref(code, { is_pinned: !state.shortcutPrefs[code]?.is_pinned });
      closeDialog(); showToast(state.shortcutPrefs[code]?.is_pinned ? "Pinned to Quick access." : "Removed from Quick access.");
      if (state.section === "home") renderCurrentPage();
      return;
    }
    case "dismiss-announcement":
      await supabaseClient.from("dismissed_announcements").insert({ announcement_id: id });
      return renderCurrentPage();
    case "restore-announcements":
      await supabaseClient.from("dismissed_announcements").delete().eq("student_id", state.user.id);
      return renderCurrentPage();
    case "finder-category": state.finderCategory = target.dataset.category; return renderFinderPage(), refreshIcons();
    case "clear-search": state.finderTerm = ""; renderAppShell(); renderFinderPage(); return refreshIcons();
    case "select-floor": state.floorId = id; return renderCurrentPage();
    case "pulse-tab": state.pulseTab = target.dataset.tab; return renderCurrentPage();
    case "staff-tab": state.staffTab = target.dataset.tab; return renderCurrentPage();
    case "edit-service": return openServiceEditor(id);
    case "edit-office": return openOfficeEditor(id);
    case "cancel-record": {
      if (!confirmInline(target)) return;
      const { error } = await supabaseClient.from(target.dataset.type).update({ status: "Cancelled" }).eq("id", id);
      if (error) return showToast("Couldn't cancel. It may already be under review.", true);
      showToast("Cancelled."); return renderCurrentPage();
    }
    case "copy-email":
      try { await navigator.clipboard.writeText(target.dataset.email); showToast("Email copied."); } catch { showToast("Couldn't copy. Select the email instead.", true); }
      return;
    case "open-notifications": return openNotifications();
    case "mark-all-read":
      await supabaseClient.from("notifications").update({ is_read: true }).eq("is_read", false);
      await refreshUnreadCount(); return openNotifications();
    case "notif-go": closeDialog(); return navigateTo(target.dataset.sectionTarget);
    case "open-profile-menu": return openProfileMenu(target);
    case "open-chatbot":
      if (window.GlitchWayveChatbot?.open) { document.getElementById("chatbotRoot").hidden = false; return window.GlitchWayveChatbot.open({ building: state.building, services: state.data.services, offices: state.data.offices }); }
      return showDialog("Ask GlitchWayve", `<p>The FAQ assistant is coming soon.</p><p class="muted">Until then, search for a service or ask an office directly.</p>
        <div class="dialog-actions"><button class="btn" type="button" data-section="directory">${icon("contact")} Help & Contact</button><button class="btn btn-primary" type="button" data-section="finder">${icon("search")} Find a service</button></div>`);
    default: return undefined;
  }
}
/** Two-step confirm on the same button (no browser confirm() pop-ups). */
function confirmInline(button) {
  if (button.dataset.confirming) return true;
  button.dataset.confirming = "1";
  button.innerHTML = `${icon("alert-triangle")} Tap again to cancel`;
  refreshIcons();
  setTimeout(() => { if (document.contains(button)) { delete button.dataset.confirming; button.innerHTML = `${icon("x-circle")} Cancel`; refreshIcons(); } }, 4000);
  return false;
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === "loginForm") { event.preventDefault(); return signIn(form); }
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (["global-search", "home-search", "finder-search"].includes(kind)) {
      state.finderTerm = form.querySelector("input").value.trim();
      state.finderCategory = "all";
      if (state.section === "finder") { renderAppShell(); renderFinderPage(); refreshIcons(); } else navigateTo("finder");
    } else if (kind === "request") {
      const details = form.elements.details.value.trim();
      if (!details) { document.getElementById("formError").textContent = "Add a few details so the office knows what you need."; return; }
      showRequestReview(state.data.services.find((x) => x.id === form.dataset.id), details);
    } else if (kind === "appointment") await submitAppointment(form);
    else if (kind === "booking") await submitBooking(form);
    else if (kind === "borrow") await submitBorrow(form);
    else if (kind === "project") await submitProject(form);
    else if (kind === "profile") await saveProfile(form);
    else if (kind === "staff-service" || kind === "staff-office") await saveStaffForm(form);
    else if (kind === "staff-status") await saveStaffStatus(form);
  } finally {
    if (submit && document.contains(submit)) submit.disabled = false;
  }
}

async function handleChange(event) {
  const el = event.target;
  if (el.dataset.setting === "text-size") { state.textSize = el.value; localStorage.setItem("gw-text-size", el.value); applyAccessibilitySettings(); }
  if (el.dataset.setting === "high-contrast") { state.highContrast = el.checked; localStorage.setItem("gw-high-contrast", el.checked); applyAccessibilitySettings(); }
  if (el.dataset.pref) {
    await saveShortcutPref(el.dataset.code, el.dataset.pref === "pin" ? { is_pinned: el.checked } : { is_hidden: el.checked });
    const row = el.closest("tr");
    row.querySelector('[data-pref="pin"]').checked = !!state.shortcutPrefs[el.dataset.code]?.is_pinned;
    row.querySelector('[data-pref="hide"]').checked = !!state.shortcutPrefs[el.dataset.code]?.is_hidden;
  }
}

/** Live search on the Finder page: results update as you type (keeps the term when switching buildings). */
let searchTimer;
function handleInput(event) {
  if (event.target.id !== "finderSearch") return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.finderTerm = event.target.value;
    const pos = event.target.selectionStart;
    renderFinderPage(); refreshIcons();
    const input = document.getElementById("finderSearch");
    input.focus(); input.setSelectionRange(pos, pos);
  }, 250);
}

function handleKeydown(event) {
  if (event.key === "Escape") { document.getElementById("profileMenu")?.remove(); closeDialog(); }
  // Arrow keys move between the two building buttons
  if (event.target.closest?.(".building-switch") && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    setBuilding(otherBuilding());
    setTimeout(() => document.querySelector(`[data-building-key="${state.building}"]`)?.focus(), 50);
  }
}

function updateOnlineStatus() {
  const banner = document.getElementById("offlineBanner");
  banner.hidden = navigator.onLine;
  refreshIcons();
  if (navigator.onLine && state.user && document.querySelector(".error-state")) renderCurrentPage();
}

async function startGlitchWayve() {
  applyAccessibilitySettings();
  applyBuildingTheme();
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("hashchange", handleRouteChange);
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  if (!supabaseClient) return renderLoginScreen();
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) { state.user = data.session.user; await openDashboard(); }
  else renderLoginScreen();
  supabaseClient.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") renderLoginScreen(); });
}

startGlitchWayve();
