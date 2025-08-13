/* ===============================
   Hotel App Front-End Logic (Fixed)
   =============================== */

const backendURL = 'https://roomcheckbackend-grf6.onrender.com';

// --- App State ---
let allChecklists = [];
let currentPage = 1;
const rowsPerPage = 5;
let allStatusReports = [];
let filteredStatusReports = [];
let allInventory = [];

// --- Auth / Role ---
let currentUserRole = null; // 'admin' | 'storemanager' | 'housekeeper' | null

// --- Tab Elements ---
const tabChecklistBtn = document.getElementById('tabChecklist');
const tabHousekeepingBtn = document.getElementById('tabHousekeeping');
const tabInventoryBtn = document.getElementById('tabInventory');

const roomChecklistSection = document.getElementById('roomChecklistSection');
const housekeepingReportSection = document.getElementById('housekeepingReportSection');
const inventorySection = document.getElementById('inventorySection');

// Role-targeted UI
const adminOnlyElements = document.querySelectorAll('.admin-only');
const storeManagerOnlyElements = document.querySelectorAll('.store-manager-only');
const housekeeperOnlyElements = document.querySelectorAll('.housekeeper-only');

/* ---------- Helpers ---------- */
const humanize = (str) =>
  String(str)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

function hasRole(role) {
  return currentUserRole === role;
}

function show(el) {
  if (el) el.classList.remove('hidden');
}
function hide(el) {
  if (el) el.classList.add('hidden');
}

function showMessage(elementId, msg, isError = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('text-green-600', 'text-red-600');
  el.classList.add(isError ? 'text-red-600' : 'text-green-600');
  setTimeout(() => {
    el.textContent = '';
  }, 5000);
}

/* ---------- Tab Logic ---------- */
function resetTabButtons() {
  [tabChecklistBtn, tabHousekeepingBtn, tabInventoryBtn].forEach((btn) => {
    if (!btn) return;
    btn.classList.remove('bg-blue-600', 'text-white');
    btn.classList.add('bg-gray-200', 'text-gray-700');
  });
}

function hideAllSections() {
  roomChecklistSection?.classList.add('hidden');
  housekeepingReportSection?.classList.add('hidden');
  inventorySection?.classList.add('hidden');
}

async function showTab(tabName) {
  hideAllSections();
  resetTabButtons();

  // Permission gating + loading
  if (tabName === 'checklist') {
    if (hasRole('admin') || hasRole('housekeeper')) {
      show(roomChecklistSection);
      tabChecklistBtn?.classList.remove('bg-gray-200', 'text-gray-700');
      tabChecklistBtn?.classList.add('bg-blue-600', 'text-white');
      await loadChecklists();
    } else {
      showMessage('mainAppMessage', 'You do not have permission to view this section.', true);
    }
  } else if (tabName === 'housekeeping') {
    if (hasRole('admin') || hasRole('housekeeper')) {
      show(housekeepingReportSection);
      tabHousekeepingBtn?.classList.remove('bg-gray-200', 'text-gray-700');
      tabHousekeepingBtn?.classList.add('bg-blue-600', 'text-white');
      await loadStatusReports();
    } else {
      showMessage('mainAppMessage', 'You do not have permission to view this section.', true);
    }
  } else if (tabName === 'inventory') {
    if (hasRole('admin') || hasRole('storemanager')) {
      show(inventorySection);
      tabInventoryBtn?.classList.remove('bg-gray-200', 'text-gray-700');
      tabInventoryBtn?.classList.add('bg-blue-600', 'text-white');
      await loadInventory();
    } else {
      showMessage('mainAppMessage', 'You do not have permission to vi
