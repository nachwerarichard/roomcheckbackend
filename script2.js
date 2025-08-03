// script.js
const backendURL = 'https://roomcheckbackend-c74g.onrender.com'; // Ensure this is correct
let allChecklists = [];
let currentPage = 1;
const rowsPerPage = 5;
let allStatusReports = [];
let filteredStatusReports = []; // New array to hold filtered status reports

// --- Tab Management ---
const tabChecklistBtn = document.getElementById('tabChecklist');
const tabHousekeepingBtn = document.getElementById('tabHousekeeping');
const roomChecklistSection = document.getElementById('roomChecklistSection');
const housekeepingReportSection = document.getElementById('housekeepingReportSection');

function showTab(tabName) {
    if (tabName === 'checklist') {
        roomChecklistSection.classList.remove('hidden');
        housekeepingReportSection.classList.add('hidden');
        tabChecklistBtn.classList.add('bg-blue-600', 'text-white');
        tabChecklistBtn.classList.remove('bg-gray-200', 'text-gray-700');
        tabHousekeepingBtn.classList.add('bg-gray-200', 'text-gray-700');
        tabHousekeepingBtn.classList.remove('bg-blue-600', 'text-white');
        loadChecklists(); // Reload data when tab is shown
    } else if (tabName === 'housekeeping') {
        housekeepingReportSection.classList.remove('hidden');
        roomChecklistSection.classList.add('hidden');
        tabHousekeepingBtn.classList.add('bg-blue-600', 'text-white');
        tabHousekeepingBtn.classList.remove('bg-gray-200', 'text-gray-700');
        tabChecklistBtn.classList.add('bg-gray-200', 'text-gray-700');
        tabChecklistBtn.classList.remove('bg-blue-600', 'text-white');
        loadStatusReports(); // Reload data when tab is shown
    }
}

tabChecklistBtn.addEventListener('click', () => showTab('checklist'));
tabHousekeepingBtn.addEventListener('click', () => showTab('housekeeping'));

// --- Utility function for displaying messages (replaces alert) ---
function displayMessage(elementId, msg, isError = false) {
    const element = document.getElementById(elementId);
    element.textContent = msg;
    element.classList.remove('text-green-600', 'text-red-600');
    if (isError) {
        element.classList.add('text-red-600');
    } else {
        element.classList.add('text-green-600');
    }
    setTimeout(() => {
        element.textContent = '';
    }, 5000); // Clear message after 5 seconds
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
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            showTab('checklist'); // Show the checklist tab by default after login
        } else {
            displayMessage('loginMsg', 'Invalid username or password.', true);
        }
    } catch (err) {
        console.error('Login error:', err);
        displayMessage('loginMsg', 'Server error during login.', true);
    }
}

// --- Room Checklist Functionality ---

// Function to export table data to Excel
function exportToExcel() {
    const table = document.getElementById("checklistTable");
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklist Data");
    XLSX.writeFile(wb, "Hotel_Room_Checklist.xlsx");
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
    delete items.room; // Remove room from the 'items' object as it's a separate field
    delete items.date; // Remove date from the 'items' object as it's a separate field

    const data = {
        room,
        date,
        items
    };

    try {
        const res = await fetch(`${backendURL}/submit-checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        let msg = result.message || 'Checklist submitted.';
        if (result.emailSent) {
            msg += ' Email sent for missing items.';
        }
        displayMessage('message', msg);

        e.target.reset(); // Reset the form after successful submission
        loadChecklists(); // Reload checklists to show the new entry
    } catch (err) {
        console.error('Error submitting checklist:', err);
        displayMessage('message', 'An error occurred while submitting the checklist.', true);
    }
});

async function loadChecklists() {
    try {
        const res = await fetch(`${backendURL}/checklists`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allChecklists = await res.json();
        renderChecklistTable();
    } catch (err) {
        console.error('Error loading checklists:', err);
        displayMessage('message', 'Failed to load checklists.', true);
    }
}

function renderChecklistTable() {
    const tbody = document.getElementById('checklistBody');
    const search = document.getElementById('searchInput').value.toLowerCase();

    // Filter data
    const filtered = allChecklists.filter(entry =>
        entry.room.toLowerCase().includes(search) ||
        entry.date.toLowerCase().includes(search) ||
        JSON.stringify(entry.items).toLowerCase().includes(search) // Search in items too
    );

    // Pagination
    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);

    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No checklists found.</td></tr>';
    } else {
        paginated.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border px-4 py-2">${entry.room}</td>
                <td class="border px-4 py-2">${entry.date}</td>
                <td class="border px-4 py-2">${Object.entries(entry.items).map(([k,v]) => `${k}: ${v}`).join(', ')}</td>
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editChecklist(${JSON.stringify(entry)})'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteChecklist("${entry._id}")'>Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }


    // Update pagination
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

function editChecklist(entry) {
    const tbody = document.getElementById('checklistBody');
    // Find the row of the item being edited to replace it, or add a new editing row
    const existingRow = Array.from(tbody.children).find(row => {
        // Find by ID if available, otherwise by content (less reliable)
        return row.querySelector('button[onclick*="deleteChecklist"]').onclick.toString().includes(`"${entry._id}"`);
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
        // Fallback: prepend if row not found (shouldn't happen if edit is clicked on existing row)
        tbody.insertAdjacentHTML('afterbegin', editRowHtml);
    }
}

async function saveChecklist(id) {
    const room = document.getElementById(`editRoom-${id}`).value;
    const date = document.getElementById(`editDate-${id}`).value;

    const itemElements = document.querySelectorAll(`[id^="item-"][id$="-${id}"]`);
    const items = {};
    itemElements.forEach(el => {
        const key = el.id.replace(`item-`, '').replace(`-${id}`, '');
        items[key] = el.value;
    });

    try {
        const res = await fetch(`${backendURL}/checklists/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room, date, items })
        });

        const result = await res.json();
        displayMessage('message', result.message || 'Checklist updated successfully!');
        await loadChecklists();
    } catch (err) {
        console.error('Error saving checklist:', err);
        displayMessage('message', 'An error occurred while saving the checklist.', true);
    }
}

async function deleteChecklist(id) {
    if (!window.confirm("Are you sure you want to delete this checklist?")) return; // Replace with custom modal

    try {
        const res = await fetch(`${backendURL}/checklists/${id}`, {
            method: 'DELETE'
        });

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

// --- Housekeeping Report Functionality ---

document.getElementById('statusReportForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${backendURL}/submit-status-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
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
        const res = await fetch(`${backendURL}/status-reports`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allStatusReports = await res.json();
        filteredStatusReports = [...allStatusReports]; // Initialize filtered data with all data
        renderStatusReportTable();
    } catch (err) {
        console.error('Error loading status reports:', err);
        displayMessage('statusMessage', 'Failed to load status reports.', true);
    }
}

function renderStatusReportTable() {
    const tbody = document.getElementById('statusReportBody');
    tbody.innerHTML = '';
    if (filteredStatusReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No housekeeping reports found.</td></tr>';
    } else {
        filteredStatusReports.forEach(report => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border px-4 py-2">${report.room}</td>
                <td class="border px-4 py-2">${report.category}</td>
                <td class="border px-4 py-2">${report.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td class="border px-4 py-2">${report.remarks}</td>
                <td class="border px-4 py-2">${new Date(report.dateTime).toLocaleString()}</td>
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editStatusReport("${report._id}")'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteStatusReport("${report._id}")'>Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Function to filter status reports by date
function filterStatusReportsByDate() {
    const filterDateInput = document.getElementById('filterDate').value;
    if (filterDateInput) {
        const selectedDate = new Date(filterDateInput);
        // Normalize selectedDate to start of day for accurate comparison
        selectedDate.setHours(0, 0, 0, 0);

        filteredStatusReports = allStatusReports.filter(report => {
            const reportDate = new Date(report.dateTime);
            reportDate.setHours(0, 0, 0, 0); // Normalize report date to start of day
            return reportDate.getTime() === selectedDate.getTime();
        });
    } else {
        filteredStatusReports = [...allStatusReports]; // If no date selected, show all
    }
    renderStatusReportTable();
}

// Function to clear the date filter
function clearStatusDateFilter() {
    document.getElementById('filterDate').value = ''; // Clear the input field
    filteredStatusReports = [...allStatusReports]; // Reset to all reports
    renderStatusReportTable();
}


function editStatusReport(id) {
    const reportToEdit = allStatusReports.find(report => report._id === id);
    if (!reportToEdit) {
        console.error('Report not found for editing:', id);
        return;
    }

    const tbody = document.getElementById('statusReportBody');
    const rowToReplace = Array.from(tbody.children).find(row => {
        return row.querySelector('button[onclick*="deleteStatusReport"]').onclick.toString().includes(`"${id}"`);
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
    const room = document.getElementById(`editReportRoom-${id}`).value;
    const category = document.getElementById(`editReportCategory-${id}`).value;
    const status = document.getElementById(`editReportStatus-${id}`).value;
    const remarks = document.getElementById(`editReportRemarks-${id}`).value;
    const dateTime = document.getElementById(`editReportDateTime-${id}`).value;

    const updatedData = { room, category, status, remarks, dateTime };

    try {
        const res = await fetch(`${backendURL}/status-reports/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        const result = await res.json();
        displayMessage('statusMessage', result.message || 'Report updated successfully!');
        loadStatusReports();
    } catch (err) {
        console.error('Error saving status report:', err);
        displayMessage('statusMessage', 'An error occurred while saving the report.', true);
    }
}

async function deleteStatusReport(id) {
    if (!window.confirm("Are you sure you want to delete this status report?")) return; // Replace with custom modal

    try {
        const res = await fetch(`${backendURL}/status-reports/${id}`, {
            method: 'DELETE'
        });
        const result = await res.json();
        displayMessage('statusMessage', result.message || 'Report deleted successfully!');
        loadStatusReports();
    } catch (err) {
        console.error('Error deleting status report:', err);
        displayMessage('statusMessage', 'An error occurred while deleting the report.', true);
    }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mainApp').style.display = 'none';
    // No initial tab display here, as login handles it.
});
