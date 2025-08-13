const backendURL = 'https://roomcheckbackend-grf6.onrender.com';
let allChecklists = [];
let currentPage = 1;
const rowsPerPage = 5;
let allStatusReports = [];
let filteredStatusReports = [];
let allInventory = [];

// --- Global variables for user authentication ---
let currentUserRole = null; // Stores the role of the logged-in user

// --- Tab Management ---
const tabChecklistBtn = document.getElementById('tabChecklist');
const tabHousekeepingBtn = document.getElementById('tabHousekeeping');
const tabInventoryBtn = document.getElementById('tabInventory');
const roomChecklistSection = document.getElementById('roomChecklistSection');
const housekeepingReportSection = document.getElementById('housekeepingReportSection');
const inventorySection = document.getElementById('inventorySection');

// New elements to hide/show based on user role
const adminOnlyElements = document.querySelectorAll('.admin-only');
const storeManagerOnlyElements = document.querySelectorAll('.store-manager-only');
const housekeeperOnlyElements = document.querySelectorAll('.housekeeper-only');

function showTab(tabName) {
    // Hide all sections first
    roomChecklistSection.classList.add('hidden');
    housekeepingReportSection.classList.add('hidden');
    inventorySection.classList.add('hidden');

    // Remove active class from all buttons
    tabChecklistBtn.classList.remove('bg-blue-600', 'text-white');
    tabHousekeepingBtn.classList.remove('bg-blue-600', 'text-white');
    tabInventoryBtn.classList.remove('bg-blue-600', 'text-white');
    tabChecklistBtn.classList.add('bg-gray-200', 'text-gray-700');
    tabHousekeepingBtn.classList.add('bg-gray-200', 'text-gray-700');
    tabInventoryBtn.classList.add('bg-gray-200', 'text-gray-700');

    // Show the selected section and add active class to button
    if (tabName === 'checklist' && (currentUserRole === 'admin' || currentUserRole === 'housekeeper')) {
        roomChecklistSection.classList.remove('hidden');
        tabChecklistBtn.classList.add('bg-blue-600', 'text-white');
        tabChecklistBtn.classList.remove('bg-gray-200', 'text-gray-700');
        loadChecklists();
    } else if (tabName === 'housekeeping' && (currentUserRole === 'admin' || currentUserRole === 'storemanager')) {
        housekeepingReportSection.classList.remove('hidden');
        tabHousekeepingBtn.classList.add('bg-blue-600', 'text-white');
        tabHousekeepingBtn.classList.remove('bg-gray-200', 'text-gray-700');
        loadStatusReports();
    } else if (tabName === 'inventory' && (currentUserRole === 'admin' || currentUserRole === 'storemanager')) {
        inventorySection.classList.remove('hidden');
        tabInventoryBtn.classList.add('bg-blue-600', 'text-white');
        tabInventoryBtn.classList.remove('bg-gray-200', 'text-gray-700');
        loadInventory();
    } else {
        // Handle cases where the user tries to access a tab they don't have permission for
        displayMessage('mainAppMessage', 'You do not have permission to view this section.', true);
    }
}

tabChecklistBtn.addEventListener('click', () => showTab('checklist'));
tabHousekeepingBtn.addEventListener('click', () => showTab('housekeeping'));
tabInventoryBtn.addEventListener('click', () => showTab('inventory'));

function displayMessage(elementId, msg, isError = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = msg;
    element.classList.remove('text-green-600', 'text-red-600');
    if (isError) {
        element.classList.add('text-red-600');
    } else {
        element.classList.add('text-green-600');
    }
    setTimeout(() => {
        element.textContent = '';
    }, 5000);
}

// --- Login Function ---
async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const loginMsg = document.getElementById('loginMsg');

    try {
        const res = await fetch(`${backendURL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (res.ok) {
            const result = await res.json();
            currentUserRole = result.role; // Store the role in the global variable
            localStorage.setItem('userRole', currentUserRole); // Save the role to local storage

            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';

            // Now, show/hide UI elements based on the role
            updateUIVisibility(currentUserRole);

            // Determine the first tab to show based on the user's role
            if (currentUserRole === 'admin' || currentUserRole === 'housekeeper') {
                showTab('checklist');
            } else if (currentUserRole === 'storemanager') {
                showTab('housekeeping'); // Or a default tab for store managers
            }
        } else {
            displayMessage('loginMsg', 'Invalid username or password.', true);
        }
    } catch (err) {
        console.error('Login error:', err);
        displayMessage('loginMsg', 'Server error during login.', true);
    }
}

// --- New function to handle front-end access control ---
function updateUIVisibility(role) {
    // Hide all role-specific elements first
    adminOnlyElements.forEach(el => el.classList.add('hidden'));
    storeManagerOnlyElements.forEach(el => el.classList.add('hidden'));
    housekeeperOnlyElements.forEach(el => el.classList.add('hidden'));

    // Show elements based on the current user's role
    switch (role) {
        case 'admin':
            document.querySelectorAll('.admin-only, .store-manager-only, .housekeeper-only').forEach(el => el.classList.remove('hidden'));
            break;
        case 'storemanager':
            document.querySelectorAll('.store-manager-only').forEach(el => el.classList.remove('hidden'));
            // Hide admin-only tabs
            tabChecklistBtn.classList.add('hidden');
            tabHousekeepingBtn.classList.add('hidden');
            tabInventoryBtn.classList.remove('hidden');
            break;
        case 'housekeeper':
            document.querySelectorAll('.housekeeper-only').forEach(el => el.classList.remove('hidden'));
            // Hide storemanager-only tabs
            tabChecklistBtn.classList.remove('hidden');
            tabHousekeepingBtn.classList.add('hidden');
            tabInventoryBtn.classList.add('hidden');
            break;
    }
}

function logout() {
    // Clear user role from local storage and memory
    localStorage.removeItem('userRole');
    currentUserRole = null;

    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';

    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginMsg').textContent = '';

    // Hide all tabs and sections when logging out
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.add('hidden'));
    document.getElementById('roomChecklistSection').classList.add('hidden');
    document.getElementById('housekeepingReportSection').classList.add('hidden');
    document.getElementById('inventorySection').classList.add('hidden');
}


// --- Room Checklist Functionality ---
function exportToExcel() {
    const dataToExport = allChecklists.map(entry => ({
        'Room': entry.room,
        'Date': entry.date,
        'Items': Object.entries(entry.items).map(([k,v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v.replace(/\b\w/g, l => l.toUpperCase())}`).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklist Data");
    XLSX.writeFile(wb, "Hotel_Room_Checklist.xlsx");
}

function printChecklists() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Room Checklist</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: sans-serif; margin: 20px; }');
    printWindow.document.write('h1 { text-align: center; margin-bottom: 20px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }');
    printWindow.document.write('th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }');
    printWindow.document.write('th { background-color: #f2f2f2; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Hotel Room Checklist</h1>');
    printWindow.document.write('<table>');
    printWindow.document.write('<thead><tr><th>Room</th><th>Date</th><th>Items</th></tr></thead>');
    printWindow.document.write('<tbody>');
    allChecklists.forEach(entry => {
        printWindow.document.write('<tr>');
        printWindow.document.write(`<td>${entry.room}</td>`);
        printWindow.document.write(`<td>${entry.date}</td>`);
        printWindow.document.write(`<td>${Object.entries(entry.items).map(([k,v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v.replace(/\b\w/g, l => l.toUpperCase())}`).join(', ')}</td>`);
        printWindow.document.write('</tr>');
    });
    printWindow.document.write('</tbody></table>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

document.getElementById('checklistForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const room = document.getElementById('room').value;
    const date = document.getElementById('date').value;
    if (!room || !date) {
        displayMessage('message', 'Please select a room and date.', true);
        return;
    }
    const formData = new FormData(e.target);
    const items = Object.fromEntries(formData.entries());
    delete items.room;
    delete items.date;

    const data = { room, date, items };
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/submit-checklist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUserRole
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        let msg = result.message || 'Checklist submitted.';
        if (result.emailSent) {
            msg += ' Email sent for missing items.';
        }
        displayMessage('message', msg);
        e.target.reset();
        loadChecklists();
    } catch (err) {
        console.error('Error submitting checklist:', err);
        displayMessage('message', 'An error occurred while submitting the checklist.', true);
    }
});

async function loadChecklists() {
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/checklists`, {
            headers: {
                'x-user-role': currentUserRole
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allChecklists = await res.json();
        renderChecklistTable();
        renderMissingItemsSummary();
    } catch (err) {
        console.error('Error loading checklists:', err);
        displayMessage('message', 'Failed to load checklists.', true);
    }
}

function renderChecklistTable() {
    const tbody = document.getElementById('checklistBody');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allChecklists.filter(entry =>
        entry.room.toLowerCase().includes(search) ||
        entry.date.toLowerCase().includes(search) ||
        JSON.stringify(entry.items).toLowerCase().includes(search)
    );
    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);
    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No checklists found.</td></tr>';
    } else {
        paginated.forEach(entry => {
            const tr = document.createElement('tr');
            const actionsHtml = (currentUserRole === 'admin') ? `
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editChecklist(${JSON.stringify(entry)})'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteChecklist("${entry._id}")'>Delete</button>
                </td>` : '';
            tr.innerHTML = `
                <td class="border px-4 py-2">${entry.room}</td>
                <td class="border px-4 py-2">${entry.date}</td>
                <td class="border px-4 py-2">${Object.entries(entry.items).map(([k,v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v.replace(/\b\w/g, l => l.toUpperCase())}`).join(', ')}</td>
                ${actionsHtml}
            `;
            tbody.appendChild(tr);
        });
    }
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    // Hide the 'Actions' header if the user isn't an admin
    const actionsHeader = document.getElementById('checklistActionsHeader');
    if (actionsHeader) {
        if (currentUserRole !== 'admin') {
            actionsHeader.classList.add('hidden');
        } else {
            actionsHeader.classList.remove('hidden');
        }
    }
}

function editChecklist(entry) {
    // Only allow admins to edit
    if (currentUserRole !== 'admin') {
        displayMessage('message', 'You do not have permission to edit checklists.', true);
        return;
    }
    const tbody = document.getElementById('checklistBody');
    const existingRow = Array.from(tbody.children).find(row => {
        const deleteButton = row.querySelector('button[onclick*="deleteChecklist"]');
        return deleteButton && deleteButton.onclick.toString().includes(`"${entry._id}"`);
    });
    const itemsHtml = Object.keys(entry.items).map(key => `
        <div class="flex items-center justify-between py-1">
            <span class="font-medium">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
            <select id="item-${key}-${entry._id}" class="px-2 py-1 border rounded-md text-sm">
                <option value="yes" ${entry.items[key] === 'yes' ? 'selected' : ''}>Yes</option>
                <option value="no" ${entry.items[key] === 'no' ? 'selected' : ''}>No</option>
            </select>
        </div>
    `).join('');
    const editRowHtml = `
        <tr class="bg-blue-50">
            <td class="border px-4 py-2"><input type="text" id="editRoom-${entry._id}" value="${entry.room}" class="w-full px-2 py-1 border rounded-md" /></td>
            <td class="border px-4 py-2"><input type="date" id="editDate-${entry._id}" value="${entry.date}" class="w-full px-2 py-1 border rounded-md" /></td>
            <td class="border px-4 py-2">
                <div class="space-y-1">
                    ${itemsHtml}
                </div>
            </td>
            <td class="border px-4 py-2">
                <button class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition duration-300 ease-in-out mr-2" onclick='saveChecklist("${entry._id}")'>Save</button>
                <button class="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 transition duration-300 ease-in-out" onclick='loadChecklists()'>Cancel</button>
            </td>
        </tr>
    `;
    if (existingRow) {
        existingRow.outerHTML = editRowHtml;
    } else {
        tbody.insertAdjacentHTML('afterbegin', editRowHtml);
    }
}

async function saveChecklist(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('message', 'You do not have permission to save changes.', true);
        return;
    }
    const room = document.getElementById(`editRoom-${id}`).value;
    const date = document.getElementById(`editDate-${id}`).value;
    const itemElements = document.querySelectorAll(`[id^="item-"][id$="-${id}"]`);
    const items = {};
    itemElements.forEach(el => {
        const key = el.id.replace(`item-`, '').replace(`-${id}`, '');
        items[key] = el.value;
    });
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/checklists/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUserRole
            },
            body: JSON.stringify({ room, date, items })
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('message', result.message || 'Checklist updated successfully!');
        await loadChecklists();
    } catch (err) {
        console.error('Error saving checklist:', err);
        displayMessage('message', 'An error occurred while saving the checklist.', true);
    }
}

async function deleteChecklist(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('message', 'You do not have permission to delete checklists.', true);
        return;
    }
    if (!window.confirm("Are you sure you want to delete this checklist?")) return;

    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/checklists/${id}`, {
            method: 'DELETE',
            headers: {
                'x-user-role': currentUserRole
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('message', result.message || 'Checklist deleted successfully!');
        await loadChecklists();
    } catch (err) {
        console.error('Error deleting checklist:', err);
        displayMessage('message', 'An error occurred while deleting the checklist.', true);
    }
}

document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    renderChecklistTable();
});

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderChecklistTable();
    }
});

document.getElementById('nextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(allChecklists.filter(entry =>
        entry.room.toLowerCase().includes(document.getElementById('searchInput').value.toLowerCase()) ||
        entry.date.toLowerCase().includes(document.getElementById('searchInput').value.toLowerCase())
    ).length / rowsPerPage);

    if (currentPage < totalPages) {
        currentPage++;
        renderChecklistTable();
    }
});

// --- Missing Items Summary Functionality ---
function renderMissingItemsSummary() {
    // Only show the summary if the user is an admin or store manager
    const summaryContainer = document.getElementById('missingItemsSummary');
    if (!summaryContainer || (currentUserRole !== 'admin' && currentUserRole !== 'storemanager')) return;

    const filterDateInput = document.getElementById('missingItemsDateFilter').value;
    let checklistsForSummary = allChecklists;

    if (filterDateInput) {
        const selectedDate = new Date(filterDateInput);
        selectedDate.setHours(0, 0, 0, 0);

        checklistsForSummary = allChecklists.filter(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === selectedDate.getTime();
        });
    }

    const missingItemsCount = {};
    const missingItemsRooms = {};

    checklistsForSummary.forEach(entry => {
        for (const itemKey in entry.items) {
            if (entry.items[itemKey] === 'no') {
                const formattedItem = itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                missingItemsCount[formattedItem] = (missingItemsCount[formattedItem] || 0) + 1;
                if (!missingItemsRooms[formattedItem]) {
                    missingItemsRooms[formattedItem] = [];
                }
                missingItemsRooms[formattedItem].push(entry.room);
            }
        }
    });

    let summaryHtml = '<h3 class="text-xl font-semibold mb-3 text-gray-800">Missing Items Summary</h3>';
    if (Object.keys(missingItemsCount).length === 0) {
        summaryHtml += '<p class="text-gray-600">No missing items found for the selected date.</p>';
    } else {
        summaryHtml += '<ul class="list-disc pl-5 space-y-2">';
        for (const item in missingItemsCount) {
            summaryHtml += `<li><span class="font-semibold">${item}</span>: ${missingItemsCount[item]} missing. (Rooms: ${missingItemsRooms[item].join(', ')})</li>`;
        }
        summaryHtml += '</ul>';
    }
    summaryContainer.innerHTML = summaryHtml;
}

document.addEventListener('DOMContentLoaded', () => {
    // Check local storage for a previously saved role
    currentUserRole = localStorage.getItem('userRole');
    if (currentUserRole) {
        // If a role is found, automatically show the main app and update the UI
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateUIVisibility(currentUserRole);
        // Load data for the default tab based on the role
        if (currentUserRole === 'admin' || currentUserRole === 'housekeeper') {
             showTab('checklist');
        } else if (currentUserRole === 'storemanager') {
             showTab('housekeeping');
        }
    } else {
        // No role found, show the login page
        document.getElementById('mainApp').style.display = 'none';
    }
});


// --- Housekeeping Report Functionality ---
document.getElementById('statusReportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/submit-status-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUserRole
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('statusMessage', result.message || 'Status report submitted.');
        e.target.reset();
        loadStatusReports();
    } catch (err) {
        console.error('Error submitting status report:', err);
        displayMessage('statusMessage', 'An error occurred while submitting the report.', true);
    }
});

async function loadStatusReports() {
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/status-reports`, {
            headers: {
                'x-user-role': currentUserRole
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allStatusReports = await res.json();
        filteredStatusReports = [...allStatusReports];
        renderStatusReportTable();
    } catch (err) {
        console.error('Error loading status reports:', err);
        displayMessage('statusMessage', 'Failed to load status reports.', true);
    }
}

function renderStatusReportTable() {
    const tbody = document.getElementById('statusReportBody');
    tbody.innerHTML = '';
    const actionsHeader = document.getElementById('statusActionsHeader');
    if (actionsHeader) {
        if (currentUserRole !== 'admin') {
            actionsHeader.classList.add('hidden');
        } else {
            actionsHeader.classList.remove('hidden');
        }
    }
    if (filteredStatusReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No housekeeping reports found.</td></tr>';
    } else {
        filteredStatusReports.forEach(report => {
            const tr = document.createElement('tr');
            const actionsHtml = (currentUserRole === 'admin') ? `
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editStatusReport("${report._id}")'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteStatusReport("${report._id}")'>Delete</button>
                </td>` : '';
            tr.innerHTML = `
                <td class="border px-4 py-2">${report.room}</td>
                <td class="border px-4 py-2">${report.category}</td>
                <td class="border px-4 py-2">${report.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td class="border px-4 py-2">${report.remarks}</td>
                <td class="border px-4 py-2">${new Date(report.dateTime).toLocaleString()}</td>
                ${actionsHtml}
            `;
            tbody.appendChild(tr);
        });
    }
}

function filterStatusReportsByDate() {
    const filterDateInput = document.getElementById('filterDate').value;
    if (filterDateInput) {
        const selectedDate = new Date(filterDateInput);
        selectedDate.setHours(0, 0, 0, 0);
        filteredStatusReports = allStatusReports.filter(report => {
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
    document.getElementById('filterDate').value = '';
    filteredStatusReports = [...allStatusReports];
    renderStatusReportTable();
}

function exportStatusReportsToExcel() {
    const dataToExport = filteredStatusReports.map(report => ({
        'Room': report.room,
        'Category': report.category,
        'Status': report.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        'Remarks': report.remarks,
        'Date & Time': new Date(report.dateTime).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Housekeeping Reports");
    XLSX.writeFile(wb, "Hotel_Housekeeping_Reports.xlsx");
}

function printStatusReports() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Housekeeping Report</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: sans-serif; margin: 20px; }');
    printWindow.document.write('h1 { text-align: center; margin-bottom: 20px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }');
    printWindow.document.write('th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }');
    printWindow.document.write('th { background-color: #f2f2f2; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Housekeeping Room Status Report</h1>');
    printWindow.document.write('<table>');
    printWindow.document.write('<thead><tr><th>Room</th><th>Category</th><th>Status</th><th>Remarks</th><th>Date & Time</th></tr></thead>');
    printWindow.document.write('<tbody>');
    filteredStatusReports.forEach(report => {
        printWindow.document.write('<tr>');
        printWindow.document.write(`<td>${report.room}</td>`);
        printWindow.document.write(`<td>${report.category}</td>`);
        printWindow.document.write(`<td>${report.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>`);
        printWindow.document.write(`<td>${report.remarks}</td>`);
        printWindow.document.write(`<td>${new Date(report.dateTime).toLocaleString()}</td>`);
        printWindow.document.write('</tr>');
    });
    printWindow.document.write('</tbody></table>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function editStatusReport(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('statusMessage', 'You do not have permission to edit reports.', true);
        return;
    }
    const reportToEdit = allStatusReports.find(report => report._id === id);
    if (!reportToEdit) {
        console.error('Report not found for editing:', id);
        return;
    }
    const tbody = document.getElementById('statusReportBody');
    const rowToReplace = Array.from(tbody.children).find(row => {
        const deleteButton = row.querySelector('button[onclick*="deleteStatusReport"]');
        return deleteButton && deleteButton.onclick.toString().includes(`"${id}"`);
    });
    const editRowHtml = `
        <tr class="bg-blue-50">
            <td class="border px-4 py-2"><input type="text" id="editReportRoom-${id}" value="${reportToEdit.room}" class="w-full px-2 py-1 border rounded-md" /></td>
            <td class="border px-4 py-2">
                <select id="editReportCategory-${id}" class="w-full px-2 py-1 border rounded-md">
                    <option value="delux1" ${reportToEdit.category === 'delux1' ? 'selected' : ''}>Delux 1</option>
                    <option value="delux2" ${reportToEdit.category === 'delux2' ? 'selected' : ''}>Delux 2</option>
                    <option value="standard" ${reportToEdit.category === 'standard' ? 'selected' : ''}>Standard</option>
                </select>
            </td>
            <td class="border px-4 py-2">
                <select id="editReportStatus-${id}" class="w-full px-2 py-1 border rounded-md">
                    <option value="arrival" ${reportToEdit.status === 'arrival' ? 'selected' : ''}>Arrival</option>
                    <option value="occupied" ${reportToEdit.status === 'occupied' ? 'selected' : ''}>Occupied</option>
                    <option value="departure" ${reportToEdit.status === 'departure' ? 'selected' : ''}>Departure</option>
                    <option value="vacant_ready" ${reportToEdit.status === 'vacant_ready' ? 'selected' : ''}>Vacant Ready</option>
                    <option value="vacant_not_ready" ${reportToEdit.status === 'vacant_not_ready' ? 'selected' : ''}>Vacant but not Ready</option>
                    <option value="out_of_order" ${reportToEdit.status === 'out_of_order' ? 'selected' : ''}>Out of Order</option>
                    <option value="out_of_service" ${reportToEdit.status === 'out_of_service' ? 'selected' : ''}>Out of Service</option>
                </select>
            </td>
            <td class="border px-4 py-2"><textarea id="editReportRemarks-${id}" class="w-full px-2 py-1 border rounded-md" rows="2">${reportToEdit.remarks}</textarea></td>
            <td class="border px-4 py-2"><input type="datetime-local" id="editReportDateTime-${id}" value="${new Date(reportToEdit.dateTime).toISOString().slice(0, 16)}" class="w-full px-2 py-1 border rounded-md" /></td>
            <td class="border px-4 py-2">
                <button class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition duration-300 ease-in-out mr-2" onclick='saveStatusReport("${id}")'>Save</button>
                <button class="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 transition duration-300 ease-in-out" onclick='loadStatusReports()'>Cancel</button>
            </td>
        </tr>
    `;
    if (rowToReplace) {
        rowToReplace.outerHTML = editRowHtml;
    } else {
        tbody.insertAdjacentHTML('afterbegin', editRowHtml);
    }
}

async function saveStatusReport(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('statusMessage', 'You do not have permission to save reports.', true);
        return;
    }
    const room = document.getElementById(`editReportRoom-${id}`).value;
    const category = document.getElementById(`editReportCategory-${id}`).value;
    const status = document.getElementById(`editReportStatus-${id}`).value;
    const remarks = document.getElementById(`editReportRemarks-${id}`).value;
    const dateTime = document.getElementById(`editReportDateTime-${id}`).value;
    const updatedData = { room, category, status, remarks, dateTime };
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/status-reports/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUserRole
            },
            body: JSON.stringify(updatedData)
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('statusMessage', result.message || 'Report updated successfully!');
        loadStatusReports();
    } catch (err) {
        console.error('Error saving status report:', err);
        displayMessage('statusMessage', 'An error occurred while saving the report.', true);
    }
}

async function deleteStatusReport(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('statusMessage', 'You do not have permission to delete reports.', true);
        return;
    }
    if (!window.confirm("Are you sure you want to delete this status report?")) return;
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/status-reports/${id}`, {
            method: 'DELETE',
            headers: {
                'x-user-role': currentUserRole
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('statusMessage', result.message || 'Report deleted successfully!');
        loadStatusReports();
    } catch (err) {
        console.error('Error deleting status report:', err);
        displayMessage('statusMessage', 'An error occurred while deleting the report.', true);
    }
}


// --- Inventory Management Functionality ---
document.getElementById('inventoryForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const item = document.getElementById('inventoryItem').value;
    const quantity = parseInt(document.getElementById('inventoryQuantity').value, 10);
    const action = document.getElementById('inventoryAction').value;
    const lowStockLevel = parseInt(document.getElementById('lowStockLevel').value, 10);
    if (!item || isNaN(quantity) || quantity <= 0) {
        displayMessage('inventoryMessage', 'Please enter a valid item name and quantity.', true);
        return;
    }
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUserRole
            },
            body: JSON.stringify({ item, quantity, action, lowStockLevel })
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        let msg = result.message || 'Inventory updated successfully.';
        if (result.lowStockEmailSent) {
            msg += ' Low stock email sent.';
        }
        displayMessage('inventoryMessage', msg);
        e.target.reset();
        loadInventory();
    } catch (err) {
        console.error('Error updating inventory:', err);
        displayMessage('inventoryMessage', 'An error occurred while updating the inventory.', true);
    }
});

async function loadInventory() {
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/inventory`, {
            headers: {
                'x-user-role': currentUserRole
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allInventory = await res.json();
        renderInventoryTable(allInventory, false);
    } catch (err) {
        console.error('Error loading inventory:', err);
        displayMessage('inventoryMessage', 'Failed to load inventory.', true);
    }
}

function renderInventoryTable(inventoryData, isSnapshot = false) {
    const tbody = document.getElementById('inventoryBody');
    const actionsHeader = document.getElementById('actionsHeader');
    const search = document.getElementById('inventorySearch').value.toLowerCase();
    
    if (actionsHeader) {
        if (currentUserRole !== 'admin') {
            actionsHeader.classList.add('hidden');
        } else {
            actionsHeader.classList.remove('hidden');
        }
    }
    
    const filteredInventory = inventoryData.filter(item =>
        item.item.toLowerCase().includes(search)
    );

    tbody.innerHTML = '';
    if (filteredInventory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isSnapshot ? 3 : 4}" class="text-center py-4 text-gray-500">No inventory items found.</td></tr>`;
    } else {
        filteredInventory.forEach(item => {
            const tr = document.createElement('tr');
            if (item.quantity <= item.lowStockLevel) {
                tr.classList.add('low-stock-warning');
            }
            
            const actionsHtml = (currentUserRole === 'admin') ? `
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editInventoryItem("${item._id}")'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteInventoryItem("${item._id}")'>Delete</button>
                </td>` : '';
            
            tr.innerHTML = `
                <td class="border px-4 py-2">${item.item}</td>
                <td class="border px-4 py-2">${item.quantity}</td>
                <td class="border px-4 py-2">${item.lowStockLevel}</td>
                ${actionsHtml}
            `;
            tbody.appendChild(tr);
        });
    }
}

function editInventoryItem(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('inventoryMessage', 'You do not have permission to edit inventory.', true);
        return;
    }
    const itemToEdit = allInventory.find(item => item._id === id);
    if (!itemToEdit) {
        console.error('Item not found for editing:', id);
        return;
    }
    const tbody = document.getElementById('inventoryBody');
    const rowToReplace = Array.from(tbody.children).find(row => {
        const deleteButton = row.querySelector('button[onclick*="deleteInventoryItem"]');
        return deleteButton && deleteButton.onclick.toString().includes(`"${id}"`);
    });
    const editRowHtml = `
        <tr class="bg-blue-50">
            <td class="border px-4 py-2"><input type="text" id="editItem-${id}" value="${itemToEdit.item}" class="w-full px-2 py-1 border rounded-md" /></td>
            <td class="border px-4 py-2"><input type="number" id="editQuantity-${id}" value="${itemToEdit.quantity}" class="w-full px-2 py-1 border rounded-md" min="0" /></td>
            <td class="border px-4 py-2"><input type="number" id="editLowstocklevel-${id}" value="${itemToEdit.lowStockLevel}" class="w-full px-2 py-1 border rounded-md" min="0" /></td>
            <td class="border px-4 py-2">
                <button class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition duration-300 ease-in-out mr-2" onclick='saveInventoryItem("${id}")'>Save</button>
                <button class="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 transition duration-300 ease-in-out" onclick='loadInventory()'>Cancel</button>
            </td>
        </tr>
    `;
    if (rowToReplace) {
        rowToReplace.outerHTML = editRowHtml;
    } else {
        tbody.insertAdjacentHTML('afterbegin', editRowHtml);
    }
}

async function saveInventoryItem(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('inventoryMessage', 'You do not have permission to save inventory.', true);
        return;
    }
    const item = document.getElementById(`editItem-${id}`).value;
    const quantity = parseInt(document.getElementById(`editQuantity-${id}`).value);
    const lowStockLevel = parseInt(document.getElementById(`editLowstocklevel-${id}`).value);
    if (!item || isNaN(quantity)) {
        displayMessage('inventoryMessage', 'Please enter a valid item and quantity.', true);
        return;
    }
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/inventory/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUserRole
            },
            body: JSON.stringify({ item, quantity, lowStockLevel })
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('inventoryMessage', result.message || 'Inventory item updated successfully!');
        loadInventory();
    } catch (err) {
        console.error('Error saving inventory item:', err);
        displayMessage('inventoryMessage', 'An error occurred while saving the inventory item.', true);
    }
}

async function deleteInventoryItem(id) {
    if (currentUserRole !== 'admin') {
        displayMessage('inventoryMessage', 'You do not have permission to delete inventory.', true);
        return;
    }
    if (!window.confirm("Are you sure you want to delete this inventory item?")) return;
    try {
        // CHANGE: Add the user role header to the request
        const res = await fetch(`${backendURL}/inventory/${id}`, {
            method: 'DELETE',
            headers: {
                'x-user-role': currentUserRole
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        displayMessage('inventoryMessage', result.message || 'Inventory item deleted successfully!');
        loadInventory();
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        displayMessage('inventoryMessage', 'An error occurred while deleting the inventory item.', true);
    }
}

function exportInventoryToExcel() {
    const dataToExport = allInventory.map(item => ({
        'Item Name': item.item,
        'Stock Level': item.quantity,
        'Low Stock Level': item.lowStockLevel
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Data");
    XLSX.writeFile(wb, "Hotel_Inventory.xlsx");
}

document.getElementById('inventorySearch').addEventListener('input', () => renderInventoryTable(allInventory, false));
