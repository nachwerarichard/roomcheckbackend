/* ===============================
  Hotel App Front-End Logic (Unrestricted)
  =============================== */

const backendURL = 'https://patrinahhotelpms.onrender.com';

// --- App State ---
let allChecklists = [];
let currentPage = 1;
const rowsPerPage = 5;
let allStatusReports = [];
let filteredStatusReports = [];
let allInventory = [];

// --- Tab Elements ---
const tabChecklistBtn = document.getElementById('tabChecklist');
const tabHousekeepingBtn = document.getElementById('tabHousekeeping');
const tabInventoryBtn = document.getElementById('tabInventory');

const roomChecklistSection = document.getElementById('roomChecklistSection');
const housekeepingReportSection = document.getElementById('housekeepingReportSection');
const inventorySection = document.getElementById('inventorySection');

/* ---------- Helpers ---------- */
const humanize = (str) =>
  String(str)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

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

  // No role-based restrictions
  if (tabName === 'checklist') {
    roomChecklistSection?.classList.remove('hidden');
    tabChecklistBtn?.classList.remove('bg-gray-200', 'text-gray-700');
    tabChecklistBtn?.classList.add('bg-blue-600', 'text-white');
    await loadChecklists();
  } else if (tabName === 'housekeeping') {
    housekeepingReportSection?.classList.remove('hidden');
    tabHousekeepingBtn?.classList.remove('bg-gray-200', 'text-gray-700');
    tabHousekeepingBtn?.classList.add('bg-blue-600', 'text-white');
    await loadStatusReports();
  } else if (tabName === 'inventory') {
    inventorySection?.classList.remove('hidden');
    tabInventoryBtn?.classList.remove('bg-gray-200', 'text-gray-700');
    tabInventoryBtn?.classList.add('bg-blue-600', 'text-white');
    await loadInventory();
  }
}

// Tab button handlers
tabChecklistBtn?.addEventListener('click', () => showTab('checklist'));
tabHousekeepingBtn?.addEventListener('click', () => showTab('housekeeping'));
tabInventoryBtn?.addEventListener('click', () => showTab('inventory'));

/* ---------- Startup ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Directly show the main app since there's no login
  document.getElementById('mainApp').style.display = 'block';
  showTab('checklist');

  const missingItemsDateFilter = document.getElementById('missingItemsDateFilter');
  if (missingItemsDateFilter) {
    missingItemsDateFilter.addEventListener('change', renderMissingItemsSummary);
  }
});

/* ---------- Room Checklist ---------- */
function exportToExcel() {
  const dataToExport = allChecklists.map((entry) => ({
    Room: entry.room,
    Date: entry.date,
    Items: Object.entries(entry.items)
      .map(([k, v]) => `${humanize(k)}: ${humanize(v)}`)
      .join(', '),
  }));
  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checklist Data');
  XLSX.writeFile(wb, 'Hotel_Room_Checklist.xlsx');
}

function printChecklists() {
  const win = window.open('', '_blank');
  win.document.write('<html><head><title>Room Checklist</title>');
  win.document.write('<style>body{font-family:sans-serif;margin:20px;}h1{text-align:center;margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th,td{border:1px solid #ccc;padding:8px;text-align:left;}th{background:#f2f2f2;}</style>');
  win.document.write('</head><body>');
  win.document.write('<h1>Hotel Room Checklist</h1>');
  win.document.write('<table><thead><tr><th>Room</th><th>Date</th><th>Items</th></tr></thead><tbody>');
  allChecklists.forEach((entry) => {
    win.document.write('<tr>');
    win.document.write(`<td>${entry.room}</td>`);
    win.document.write(`<td>${entry.date}</td>`);
    win.document.write(
      `<td>${Object.entries(entry.items)
        .map(([k, v]) => `${humanize(k)}: ${humanize(v)}`)
        .join(', ')}</td>`
    );
    win.document.write('</tr>');
  });
  win.document.write('</tbody></table></body></html>');
  win.document.close();
  win.print();
}

document.getElementById('checklistForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const room = document.getElementById('room').value;
  const date = document.getElementById('date').value;
  if (!room || !date) {
    showMessage('message', 'Please select a room and date.', true);
    return;
  }
  const formData = new FormData(e.target);
  const items = Object.fromEntries(formData.entries());
  delete items.room;
  delete items.date;

  try {
    const res = await fetch(`${backendURL}/submit-checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ room, date, items }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const result = await res.json();
    let msg = result.message || 'Checklist submitted.';
    if (result.emailSent) msg += ' Email sent for missing items.';
    showMessage('message', msg);
    e.target.reset();
    await loadChecklists();
  } catch (err) {
    console.error('Error submitting checklist:', err);
    showMessage('message', 'An error occurred while submitting the checklist.', true);
  }
});

async function loadChecklists() {
  try {
    const res = await fetch(`${backendURL}/checklists`, {});
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    allChecklists = await res.json();
    renderChecklistTable();
    renderMissingItemsSummary();
  } catch (err) {
    console.error('Error loading checklists:', err);
    showMessage('message', 'Failed to load checklists.', true);
  }
}

function getFilteredChecklists() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  return allChecklists.filter((entry) => {
    const haystack =
      `${entry.room} ${entry.date} ${JSON.stringify(entry.items)}`.toLowerCase();
    return haystack.includes(search);
  });
}

function renderChecklistTable() {
  const tbody = document.getElementById('checklistBody');
  if (!tbody) return;
  const actionsHeader = document.getElementById('checklistActionsHeader');
  if (actionsHeader) actionsHeader.classList.remove('hidden');

  const filtered = getFilteredChecklists();
  const start = (currentPage - 1) * rowsPerPage;
  const pageSlice = filtered.slice(start, start + rowsPerPage);

  tbody.innerHTML = '';

  if (pageSlice.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center py-4 text-gray-500">No checklists found.</td></tr>';
  } else {
    pageSlice.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.dataset.id = entry._id;
      const actionsHtml = `
        <td class="border px-4 py-2">
          <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 mr-2"
            onclick='editChecklist("${entry._id}")'>Edit</button>
          <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
            onclick='deleteChecklist("${entry._id}")'>Delete</button>
        </td>`;

      tr.innerHTML = `
        <td class="border px-4 py-2">${entry.room}</td>
        <td class="border px-4 py-2">${entry.date}</td>
        <td class="border px-4 py-2">
          ${Object.entries(entry.items).map(([k, v]) => `${humanize(k)}: ${humanize(v)}`).join(', ')}
        </td>
        ${actionsHtml}
      `;
      tbody.appendChild(tr);
    });
  }

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevBtn').disabled = currentPage === 1;
  document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

function editChecklist(id) {
  const entry = allChecklists.find((c) => c._id === id);
  if (!entry) return;

  const tbody = document.getElementById('checklistBody');
  const row = tbody.querySelector(`tr[data-id="${id}"]`);
  const itemsHtml = Object.keys(entry.items)
    .map(
      (key) => `
      <div class="flex items-center justify-between py-1">
        <span class="font-medium">${humanize(key)}:</span>
        <select id="item-${key}-${id}" class="px-2 py-1 border rounded-md text-sm">
          <option value="yes" ${entry.items[key] === 'yes' ? 'selected' : ''}>Yes</option>
          <option value="no" ${entry.items[key] === 'no' ? 'selected' : ''}>No</option>
        </select>
      </div>`
    )
    .join('');

  const editRowHtml = `
    <tr class="bg-blue-50" data-id="${id}">
      <td class="border px-4 py-2">
        <input type="text" id="editRoom-${id}" value="${entry.room}" class="w-full px-2 py-1 border rounded-md"/>
      </td>
      <td class="border px-4 py-2">
        <input type="date" id="editDate-${id}" value="${entry.date}" class="w-full px-2 py-1 border rounded-md"/>
      </td>
      <td class="border px-4 py-2">
        <div class="space-y-1">${itemsHtml}</div>
      </td>
      <td class="border px-4 py-2">
        <button class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 mr-2" onclick='saveChecklist("${id}")'>Save</button>
        <button class="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600" onclick='loadChecklists()'>Cancel</button>
      </td>
    </tr>
  `;
  if (row) row.outerHTML = editRowHtml;
}

async function saveChecklist(id) {
  const room = document.getElementById(`editRoom-${id}`).value;
  const date = document.getElementById(`editDate-${id}`).value;
  const itemElements = document.querySelectorAll(`[id^="item-"][id$="-${id}"]`);
  const items = {};
  itemElements.forEach((el) => {
    const key = el.id.replace(`item-`, '').replace(`-${id}`, '');
    items[key] = el.value;
  });

  try {
    const res = await fetch(`${backendURL}/checklists/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ room, date, items }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('message', result.message || 'Checklist updated successfully!');
    await loadChecklists();
  } catch (err) {
    console.error('Error saving checklist:', err);
    showMessage('message', 'An error occurred while saving the checklist.', true);
  }
}

async function deleteChecklist(id) {
  if (!window.confirm('Are you sure you want to delete this checklist?')) return;

  try {
    const res = await fetch(`${backendURL}/checklists/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('message', result.message || 'Checklist deleted successfully!');
    await loadChecklists();
  } catch (err) {
    console.error('Error deleting checklist:', err);
    showMessage('message', 'An error occurred while deleting the checklist.', true);
  }
}

// Checklist search & pagination
document.getElementById('searchInput')?.addEventListener('input', () => {
  currentPage = 1;
  renderChecklistTable();
});

document.getElementById('prevBtn')?.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderChecklistTable();
  }
});

document.getElementById('nextBtn')?.addEventListener('click', () => {
  const totalPages = Math.ceil(getFilteredChecklists().length / rowsPerPage) || 1;
  if (currentPage < totalPages) {
    currentPage++;
    renderChecklistTable();
  }
});

/* ---------- Missing Items Summary ---------- */
function renderMissingItemsSummary() {
  const summaryContainer = document.getElementById('missingItemsSummary');
  if (!summaryContainer) return;

  const filterDateInput = document.getElementById('missingItemsDateFilter')?.value;
  let data = allChecklists;

  if (filterDateInput) {
    const selectedDate = new Date(filterDateInput);
    selectedDate.setHours(0, 0, 0, 0);

    data = allChecklists.filter((entry) => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === selectedDate.getTime();
    });
  }

  const missingItemsCount = {};
  const missingItemsRooms = {};

  data.forEach((entry) => {
    for (const itemKey in entry.items) {
      if (String(entry.items[itemKey]).toLowerCase() === 'no') {
        const label = humanize(itemKey);
        missingItemsCount[label] = (missingItemsCount[label] || 0) + 1;
        if (!missingItemsRooms[label]) missingItemsRooms[label] = [];
        missingItemsRooms[label].push(entry.room);
      }
    }
  });

  let html = '<h3 class="text-xl font-semibold mb-3 text-gray-800">Missing Items Summary</h3>';
  if (Object.keys(missingItemsCount).length === 0) {
    html += '<p class="text-gray-600">No missing items found for the selected date.</p>';
  } else {
    html += '<ul class="list-disc pl-5 space-y-2">';
    for (const item in missingItemsCount) {
      html += `<li><span class="font-semibold">${item}</span>: ${missingItemsCount[item]} missing. (Rooms: ${missingItemsRooms[item].join(', ')})</li>`;
    }
    html += '</ul>';
  }
  summaryContainer.innerHTML = html;
}

/* ---------- Housekeeping Reports ---------- */
document.getElementById('statusReportForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${backendURL}/submit-status-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('statusMessage', result.message || 'Status report submitted.');
    e.target.reset();
    await loadStatusReports();
  } catch (err) {
    console.error('Error submitting status report:', err);
    showMessage('statusMessage', 'An error occurred while submitting the report.', true);
  }
});

async function loadStatusReports() {
  try {
    const res = await fetch(`${backendURL}/status-reports`, {});
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    allStatusReports = await res.json();
    filteredStatusReports = [...allStatusReports];
    renderStatusReportTable();
  } catch (err) {
    console.error('Error loading status reports:', err);
    showMessage('statusMessage', 'Failed to load status reports.', true);
  }
}

function renderStatusReportTable() {
  const tbody = document.getElementById('statusReportBody');
  if (!tbody) return;
  const actionsHeader = document.getElementById('statusActionsHeader');
  if (actionsHeader) actionsHeader.classList.remove('hidden');

  tbody.innerHTML = '';
  if (filteredStatusReports.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center py-4 text-gray-500">No housekeeping reports found.</td></tr>';
    return;
  }

  filteredStatusReports.forEach((report) => {
    const tr = document.createElement('tr');
    tr.dataset.id = report._id;
    const actionsHtml = `
      <td class="border px-4 py-2">
        <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 mr-2" onclick='editStatusReport("${report._id}")'>Edit</button>
        <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600" onclick='deleteStatusReport("${report._id}")'>Delete</button>
      </td>`;

    tr.innerHTML = `
      <td class="border px-4 py-2">${report.room}</td>
      <td class="border px-4 py-2">${report.category}</td>
      <td class="border px-4 py-2">${humanize(report.status)}</td>
      <td class="border px-4 py-2">${report.remarks}</td>
      <td class="border px-4 py-2">${new Date(report.dateTime).toLocaleString()}</td>
      ${actionsHtml}
    `;
    tbody.appendChild(tr);
  });
}

function filterStatusReportsByDate() {
  const filterDateInput = document.getElementById('filterDate')?.value;
  if (filterDateInput) {
    const selectedDate = new Date(filterDateInput);
    selectedDate.setHours(0, 0, 0, 0);
    filteredStatusReports = allStatusReports.filter((report) => {
      const reportDate = new Date(report.dateTime);
      reportDate.setHours(0, 0, 0, 0);
      return reportDate.getTime() === selectedDate.getTime();
    });
  } else {
    filteredStatusReports = [...allStatusReports];
  }
  renderStatusReportTable();
}

function clearStatusDateFilter() {
  const el = document.getElementById('filterDate');
  if (el) el.value = '';
  filteredStatusReports = [...allStatusReports];
  renderStatusReportTable();
}

function exportStatusReportsToExcel() {
  const dataToExport = filteredStatusReports.map((report) => ({
    Room: report.room,
    Category: report.category,
    Status: humanize(report.status),
    Remarks: report.remarks,
    'Date & Time': new Date(report.dateTime).toLocaleString(),
  }));
  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Housekeeping Reports');
  XLSX.writeFile(wb, 'Hotel_Housekeeping_Reports.xlsx');
}

function printStatusReports() {
  const win = window.open('', '_blank');
  win.document.write('<html><head><title>Housekeeping Report</title>');
  win.document.write('<style>body{font-family:sans-serif;margin:20px;}h1{text-align:center;margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th,td{border:1px solid #ccc;padding:8px;text-align:left;}th{background:#f2f2f2;}</style>');
  win.document.write('</head><body>');
  win.document.write('<h1>Housekeeping Room Status Report</h1>');
  win.document.write('<table><thead><tr><th>Room</th><th>Category</th><th>Status</th><th>Remarks</th><th>Date & Time</th></tr></thead><tbody>');
  filteredStatusReports.forEach((report) => {
    win.document.write('<tr>');
    win.document.write(`<td>${report.room}</td>`);
    win.document.write(`<td>${report.category}</td>`);
    win.document.write(`<td>${humanize(report.status)}</td>`);
    win.document.write(`<td>${report.remarks}</td>`);
    win.document.write(`<td>${new Date(report.dateTime).toLocaleString()}</td>`);
    win.document.write('</tr>');
  });
  win.document.write('</tbody></table></body></html>');
  win.document.close();
  win.print();
}

function editStatusReport(id) {
  const report = allStatusReports.find((r) => r._id === id);
  if (!report) return;

  const tbody = document.getElementById('statusReportBody');
  const row = tbody.querySelector(`tr[data-id="${id}"]`);

  const editRowHtml = `
    <tr class="bg-blue-50" data-id="${id}">
      <td class="border px-4 py-2"><input type="text" id="editReportRoom-${id}" value="${report.room}" class="w-full px-2 py-1 border rounded-md"/></td>
      <td class="border px-4 py-2">
        <select id="editReportCategory-${id}" class="w-full px-2 py-1 border rounded-md">
          <option value="delux1" ${report.category === 'delux1' ? 'selected' : ''}>Delux 1</option>
          <option value="delux2" ${report.category === 'delux2' ? 'selected' : ''}>Delux 2</option>
          <option value="standard" ${report.category === 'standard' ? 'selected' : ''}>Standard</option>
        </select>
      </td>
      <td class="border px-4 py-2">
        <select id="editReportStatus-${id}" class="w-full px-2 py-1 border rounded-md">
          <option value="arrival" ${report.status === 'arrival' ? 'selected' : ''}>Arrival</option>
          <option value="occupied" ${report.status === 'occupied' ? 'selected' : ''}>Occupied</option>
          <option value="departure" ${report.status === 'departure' ? 'selected' : ''}>Departure</option>
          <option value="vacant_ready" ${report.status === 'vacant_ready' ? 'selected' : ''}>Vacant Ready</option>
          <option value="vacant_not_ready" ${report.status === 'vacant_not_ready' ? 'selected' : ''}>Vacant but not Ready</option>
          <option value="out_of_order" ${report.status === 'out_of_order' ? 'selected' : ''}>Out of Order</option>
          <option value="out_of_service" ${report.status === 'out_of_service' ? 'selected' : ''}>Out of Service</option>
        </select>
      </td>
      <td class="border px-4 py-2"><textarea id="editReportRemarks-${id}" class="w-full px-2 py-1 border rounded-md" rows="2">${report.remarks}</textarea></td>
      <td class="border px-4 py-2"><input type="datetime-local" id="editReportDateTime-${id}" value="${new Date(report.dateTime).toISOString().slice(0,16)}" class="w-full px-2 py-1 border rounded-md"/></td>
      <td class="border px-4 py-2">
        <button class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 mr-2" onclick='saveStatusReport("${id}")'>Save</button>
        <button class="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600" onclick='loadStatusReports()'>Cancel</button>
      </td>
    </tr>
  `;
  if (row) row.outerHTML = editRowHtml;
}

async function saveStatusReport(id) {
  const updatedData = {
    room: document.getElementById(`editReportRoom-${id}`).value,
    category: document.getElementById(`editReportCategory-${id}`).value,
    status: document.getElementById(`editReportStatus-${id}`).value,
    remarks: document.getElementById(`editReportRemarks-${id}`).value,
    dateTime: document.getElementById(`editReportDateTime-${id}`).value,
  };

  try {
    const res = await fetch(`${backendURL}/status-reports/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedData),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('statusMessage', result.message || 'Report updated successfully!');
    await loadStatusReports();
  } catch (err) {
    console.error('Error saving status report:', err);
    showMessage('statusMessage', 'An error occurred while saving the report.', true);
  }
}

async function deleteStatusReport(id) {
  if (!window.confirm('Are you sure you want to delete this status report?')) return;

  try {
    const res = await fetch(`${backendURL}/status-reports/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('statusMessage', result.message || 'Report deleted successfully!');
    await loadStatusReports();
  } catch (err) {
    console.error('Error deleting status report:', err);
    showMessage('statusMessage', 'An error occurred while deleting the report.', true);
  }
}

/* ---------- Inventory ---------- */
document.getElementById('inventoryForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const item = document.getElementById('inventoryItem').value;
  const quantity = parseInt(document.getElementById('inventoryQuantity').value, 10);
  const action = document.getElementById('inventoryAction').value;
  const lowStockLevel = parseInt(document.getElementById('lowStockLevel').value, 10);

  if (!item || isNaN(quantity) || quantity <= 0) {
    showMessage('inventoryMessage', 'Please enter a valid item name and quantity.', true);
    return;
  }

  try {
    const res = await fetch(`${backendURL}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item, quantity, action, lowStockLevel }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    let msg = result.message || 'Inventory updated successfully.';
    if (result.lowStockEmailSent) msg += ' Low stock email sent.';
    showMessage('inventoryMessage', msg);
    e.target.reset();
    await loadInventory();
  } catch (err) {
    console.error('Error updating inventory:', err);
    showMessage('inventoryMessage', 'An error occurred while updating the inventory.', true);
  }
});

async function loadInventory() {
  try {
    const res = await fetch(`${backendURL}/inventory`, {});
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    allInventory = await res.json();
    renderInventoryTable(allInventory, false);
  } catch (err) {
    console.error('Error loading inventory:', err);
    showMessage('inventoryMessage', 'Failed to load inventory.', true);
  }
}

function renderInventoryTable(inventoryData, isSnapshot = false) {
  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;

  const actionsHeader = document.getElementById('actionsHeader');
  if (actionsHeader) actionsHeader.classList.remove('hidden');

  const search = (document.getElementById('inventorySearch')?.value || '').toLowerCase();
  const filteredInventory = inventoryData.filter((i) =>
    i.item.toLowerCase().includes(search)
  );

  tbody.innerHTML = '';

  if (filteredInventory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isSnapshot ? 3 : 4}" class="text-center py-4 text-gray-500">No inventory items found.</td></tr>`;
    return;
  }

  filteredInventory.forEach((it) => {
    const tr = document.createElement('tr');
    tr.dataset.id = it._id;
    if (Number(it.quantity) <= Number(it.lowStockLevel)) {
      tr.classList.add('low-stock-warning');
    }

    const actionsHtml = `
      <td class="border px-4 py-2">
        <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 mr-2" onclick='editInventoryItem("${it._id}")'>Edit</button>
        <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600" onclick='deleteInventoryItem("${it._id}")'>Delete</button>
      </td>`;

    tr.innerHTML = `
      <td class="border px-4 py-2">${it.item}</td>
      <td class="border px-4 py-2">${it.quantity}</td>
      <td class="border px-4 py-2">${it.lowStockLevel}</td>
      ${actionsHtml}
    `;
    tbody.appendChild(tr);
  });
}

function editInventoryItem(id) {
  const target = allInventory.find((x) => x._id === id);
  if (!target) return;

  const tbody = document.getElementById('inventoryBody');
  const row = tbody.querySelector(`tr[data-id="${id}"]`);
  const editRowHtml = `
    <tr class="bg-blue-50" data-id="${id}">
      <td class="border px-4 py-2"><input type="text" id="editItem-${id}" value="${target.item}" class="w-full px-2 py-1 border rounded-md"/></td>
      <td class="border px-4 py-2"><input type="number" id="editQuantity-${id}" value="${target.quantity}" class="w-full px-2 py-1 border rounded-md" min="0"/></td>
      <td class="border px-4 py-2"><input type="number" id="editLowStockLevel-${id}" value="${target.lowStockLevel}" class="w-full px-2 py-1 border rounded-md" min="0"/></td>
      <td class="border px-4 py-2">
        <button class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 mr-2" onclick='saveInventoryItem("${id}")'>Save</button>
        <button class="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600" onclick='loadInventory()'>Cancel</button>
      </td>
    </tr>
  `;
  if (row) row.outerHTML = editRowHtml;
}

async function saveInventoryItem(id) {
  const item = document.getElementById(`editItem-${id}`).value;
  const quantity = parseInt(document.getElementById(`editQuantity-${id}`).value, 10);
  const lowStockLevel = parseInt(document.getElementById(`editLowStockLevel-${id}`).value, 10);

  if (!item || isNaN(quantity) || isNaN(lowStockLevel)) {
    showMessage('inventoryMessage', 'Please enter a valid item, quantity and low stock level.', true);
    return;
  }

  try {
    const res = await fetch(`${backendURL}/inventory/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item, quantity, lowStockLevel }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('inventoryMessage', result.message || 'Inventory item updated successfully!');
    await loadInventory();
  } catch (err) {
    console.error('Error saving inventory item:', err);
    showMessage('inventoryMessage', 'An error occurred while saving the inventory item.', true);
  }
}

async function deleteInventoryItem(id) {
  if (!window.confirm('Are you sure you want to delete this inventory item?')) return;

  try {
    const res = await fetch(`${backendURL}/inventory/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const result = await res.json();
    showMessage('inventoryMessage', result.message || 'Inventory item deleted successfully!');
    await loadInventory();
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    showMessage('inventoryMessage', 'An error occurred while deleting the inventory item.', true);
  }
}

function exportInventoryToExcel() {
  const dataToExport = allInventory.map((it) => ({
    'Item Name': it.item,
    'Stock Level': it.quantity,
    'Low Stock Level': it.lowStockLevel,
  }));
  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory Data');
  XLSX.writeFile(wb, 'Hotel_Inventory.xlsx');
}

// Inventory search
document.getElementById('inventorySearch')?.addEventListener('input', () =>
  renderInventoryTable(allInventory, false)
);


        // JavaScript functions from the First Piece
        function toggleMenu(id, element) {
            const submenu = document.getElementById(id);
            const icon = element.querySelector("i");

            const isSubmenuOpen = submenu.style.display === "flex";

            // Close all submenus and reset icons
            document.querySelectorAll('.submenu').forEach(menu => menu.style.display = 'none');
            document.querySelectorAll('.nav-item i').forEach(ic => {
                ic.classList.remove("fa-chevron-up");
                ic.classList.add("fa-chevron-down");
            });

            // Open the clicked submenu only if it was not already open
            if (!isSubmenuOpen) {
                submenu.style.display = "flex";
                icon.classList.remove("fa-chevron-down");
                icon.classList.add("fa-chevron-up");
            }
        }

        function showSection(id) {
            // Remove active state from all tab-content elements
            document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
            // Add active state to the selected tab-content element
            document.getElementById(id).classList.add('active');

            // Close all submenus when a section is selected for a cleaner UI
            document.querySelectorAll('.submenu').forEach(menu => menu.style.display = 'none');
            document.querySelectorAll('.nav-item i').forEach(ic => {
                ic.classList.remove("fa-chevron-up");
                ic.classList.add("fa-chevron-down");
            });

            // Optional: Highlight the parent nav-item
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            // This part is a bit more complex in pure JS without knowing the parent, but for a simple design:
            // Find the button and its parent submenu, then the submenu's previous sibling (the nav-item)
            const button = document.querySelector(`#${id}`).closest('.submenu').previousElementSibling;
            if (button) {
                 button.classList.add('active');
            }
        }
        
        // Initial load: show the checklist form
        document.addEventListener('DOMContentLoaded', () => {
            showSection('checklistForm');
            // Manually activate the first nav-item to show initial state
            document.querySelector('.nav-item').classList.add('active');
        });

        // The remaining functions (exportToExcel, printChecklists, filterStatusReportsByDate, etc.) 
        // are expected to be in the linked 'script3.js' file. 
    

// Expose functions used by inline onclick
window.showTab = showTab;
window.exportToExcel = exportToExcel;
window.printChecklists = printChecklists;
window.editChecklist = editChecklist;
window.saveChecklist = saveChecklist;
window.deleteChecklist = deleteChecklist;
window.filterStatusReportsByDate = filterStatusReportsByDate;
window.clearStatusDateFilter = clearStatusDateFilter;
window.exportStatusReportsToExcel = exportStatusReportsToExcel;
window.printStatusReports = printStatusReports;
window.editStatusReport = editStatusReport;
window.saveStatusReport = saveStatusReport;
window.deleteStatusReport = deleteStatusReport;
window.exportInventoryToExcel = exportInventoryToExcel;
window.editInventoryItem = editInventoryItem;
window.saveInventoryItem = saveInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;
