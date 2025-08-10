// script.js
const backendURL = 'https://roomcheckbackend-grf6.onrender.com'; // Ensure this is correct
let allChecklists = [];
let currentPage = 1;
const rowsPerPage = 5;
let allStatusReports = [];
let filteredStatusReports = [];
let allInventory = []; // New array to hold all inventory items

// --- Tab Management ---
const tabChecklistBtn = document.getElementById('tabChecklist');
const tabHousekeepingBtn = document.getElementById('tabHousekeeping');
const tabInventoryBtn = document.getElementById('tabInventory'); // New tab button
const roomChecklistSection = document.getElementById('roomChecklistSection');
const housekeepingReportSection = document.getElementById('housekeepingReportSection');
const inventorySection = document.getElementById('inventorySection'); // New section

/**
 * Shows the selected tab and hides the others.
 * Also triggers data loading for the active tab.
 * @param {string} tabName - 'checklist', 'housekeeping', or 'inventory'
 */
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
    if (tabName === 'checklist') {
        roomChecklistSection.classList.remove('hidden');
        tabChecklistBtn.classList.add('bg-blue-600', 'text-white');
        tabChecklistBtn.classList.remove('bg-gray-200', 'text-gray-700');
        loadChecklists(); // Reload data when tab is shown
    } else if (tabName === 'housekeeping') {
        housekeepingReportSection.classList.remove('hidden');
        tabHousekeepingBtn.classList.add('bg-blue-600', 'text-white');
        tabHousekeepingBtn.classList.remove('bg-gray-200', 'text-gray-700');
        loadStatusReports(); // Reload data when tab is shown
    } else if (tabName === 'inventory') {
        inventorySection.classList.remove('hidden');
        tabInventoryBtn.classList.add('bg-blue-600', 'text-white');
        tabInventoryBtn.classList.remove('bg-gray-200', 'text-gray-700');
        loadInventory(); // Load inventory data when tab is shown
    }
}

// Event listeners for tab buttons
tabChecklistBtn.addEventListener('click', () => showTab('checklist'));
tabHousekeepingBtn.addEventListener('click', () => showTab('housekeeping'));
tabInventoryBtn.addEventListener('click', () => showTab('inventory')); // New event listener

// --- Utility function for displaying messages (replaces alert) ---
/**
 * Displays a message in a specified HTML element.
 * @param {string} elementId - The ID of the HTML element to display the message in.
 * @param {string} msg - The message to display.
 * @param {boolean} [isError=false] - True if the message is an error, false otherwise.
 */
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

/**
 * Exports the data from the checklist table (Room, Date, Items) to an Excel file.
 */
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

/**
 * Prints the data from the checklist table (Room, Date, Items) in a new window.
 */
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

// Event listener for checklist form submission
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

/**
 * Fetches all checklists from the backend and updates the `allChecklists` array.
 */
async function loadChecklists() {
    try {
        const res = await fetch(`${backendURL}/checklists`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allChecklists = await res.json();
        renderChecklistTable();
        renderMissingItemsSummary(); // Call to render missing items summary
    } catch (err) {
        console.error('Error loading checklists:', err);
        displayMessage('message', 'Failed to load checklists.', true);
    }
}

/**
 * Renders the checklist table with filtered and paginated data.
 */
function renderChecklistTable() {
    const tbody = document.getElementById('checklistBody');
    const search = document.getElementById('searchInput').value.toLowerCase();

    // Filter data based on search input
    const filtered = allChecklists.filter(entry =>
        entry.room.toLowerCase().includes(search) ||
        entry.date.toLowerCase().includes(search) ||
        JSON.stringify(entry.items).toLowerCase().includes(search) // Search in items too
    );

    // Apply pagination
    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);

    tbody.innerHTML = ''; // Clear existing rows
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No checklists found.</td></tr>';
    } else {
        paginated.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border px-4 py-2">${entry.room}</td>
                <td class="border px-4 py-2">${entry.date}</td>
                <td class="border px-4 py-2">${Object.entries(entry.items).map(([k,v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v.replace(/\b\w/g, l => l.toUpperCase())}`).join(', ')}</td>
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editChecklist(${JSON.stringify(entry)})'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteChecklist("${entry._id}")'>Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Update pagination info and button states
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

/**
 * Populates the edit form for a selected checklist entry.
 * @param {object} entry - The checklist entry object to edit.
 */
function editChecklist(entry) {
    const tbody = document.getElementById('checklistBody');
    const existingRow = Array.from(tbody.children).find(row => {
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
        tbody.insertAdjacentHTML('afterbegin', editRowHtml);
    }
}

/**
 * Saves the edited checklist entry to the backend.
 * @param {string} id - The ID of the checklist entry to save.
 */
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

/**
 * Deletes a checklist entry from the backend.
 * @param {string} id - The ID of the checklist entry to delete.
 */
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

// Event listeners for checklist search and pagination
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
/**
 * Renders a summary of missing items and the rooms they are missing from for a given date.
 */
function renderMissingItemsSummary() {
    const summaryContainer = document.getElementById('missingItemsSummary');
    if (!summaryContainer) return; // Exit if the container doesn't exist (e.g., before login)

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

    const missingItemsCount = {}; // { item: count }
    const missingItemsRooms = {}; // { item: [room1, room2] }

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

// Event listeners for missing items date filter
document.addEventListener('DOMContentLoaded', () => {
    const missingItemsDateFilter = document.getElementById('missingItemsDateFilter');
    if (missingItemsDateFilter) {
        missingItemsDateFilter.addEventListener('change', renderMissingItemsSummary);
    }
    const clearMissingItemsDateFilterBtn = document.getElementById('clearMissingItemsDateFilter');
    if (clearMissingItemsDateFilterBtn) {
        clearMissingItemsDateFilterBtn.addEventListener('click', () => {
            missingItemsDateFilter.value = '';
            renderMissingItemsSummary();
        });
    }
});


// --- Housekeeping Report Functionality ---

// Event listener for status report form submission
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

/**
 * Fetches all status reports from the backend and updates the `allStatusReports` array.
 */
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

/**
 * Renders the status report table with filtered data.
 */
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

/**
 * Filters the `allStatusReports` by the selected date and updates `filteredStatusReports`.
 */
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

/**
 * Clears the date filter and resets `filteredStatusReports` to all reports.
 */
function clearStatusDateFilter() {
    document.getElementById('filterDate').value = ''; // Clear the input field
    filteredStatusReports = [...allStatusReports]; // Reset to all reports
    renderStatusReportTable();
}

/**
 * Exports the current `filteredStatusReports` (specific columns) to an Excel file.
 */
function exportStatusReportsToExcel() {
    // Prepare data with only the desired columns
    const dataToExport = filteredStatusReports.map(report => ({
        'Room': report.room,
        'Category': report.category,
        'Status': report.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Format status for readability
        'Remarks': report.remarks,
        'Date & Time': new Date(report.dateTime).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport); // Use json_to_sheet for structured data
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Housekeeping Reports");
    XLSX.writeFile(wb, "Hotel_Housekeeping_Reports.xlsx");
}

/**
 * Prints the current `filteredStatusReports` (specific columns) in a new window.
 */
function printStatusReports() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Housekeeping Report</title>');
    // Add basic styling for print
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

/**
 * Populates the edit form for a selected status report entry.
 * @param {string} id - The ID of the status report entry to edit.
 */
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

/**
 * Saves the edited status report entry to the backend.
 * @param {string} id - The ID of the status report entry to save.
 */
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

/**
 * Deletes a status report entry from the backend.
 * @param {string} id - The ID of the status report entry to delete.
 */
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


// --- Inventory Management Functionality ---

// Event listener for inventory form submission
document.getElementById('inventoryForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const item = document.getElementById('inventoryItem').value;
    const quantity = parseInt(document.getElementById('inventoryQuantity').value, 10);
    const action = document.getElementById('inventoryAction').value;
    const lowstocklevel = document.getElementById('lowStockLevel').value;

    if (!item || isNaN(quantity) || quantity <= 0) {
        displayMessage('inventoryMessage', 'Please enter a valid item name and quantity.', true);
        return;
    }

    try {
        const res = await fetch(`${backendURL}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, quantity, action })
        });
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

/**
 * Fetches all inventory items from the backend and updates the `allInventory` array.
 */
async function loadInventory() {
    try {
        const res = await fetch(`${backendURL}/inventory`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        allInventory = await res.json();
        renderInventoryTable();
    } catch (err) {
        console.error('Error loading inventory:', err);
        displayMessage('inventoryMessage', 'Failed to load inventory.', true);
    }
}

/**
 * Renders the inventory table with filtered data.
 */
function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody');
    const search = document.getElementById('inventorySearch').value.toLowerCase();

    const filteredInventory = allInventory.filter(item =>
        item.item.toLowerCase().includes(search)
    );

    tbody.innerHTML = '';
    if (filteredInventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No inventory items found.</td></tr>';
    } else {
        filteredInventory.forEach(item => {
            const tr = document.createElement('tr');
            // Determine the low stock class.
            const lowStockClass = item.lowStockLevel;
            
            // Correctly apply the class to the row.
            // This ensures other classes on the row are not overwritten.
            tr.className = `${lowStockClass}`; 
            
            tr.innerHTML = `
                <td class="border px-4 py-2">${item.item}</td>
                <td class="border px-4 py-2">${item.quantity}</td>
                <td class="border px-4 py-2">${item.lowStockLevel}</td>
                <td class="border px-4 py-2">
                    <button class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition duration-300 ease-in-out mr-2" onclick='editInventoryItem("${item._id}")'>Edit</button>
                    <button class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition duration-300 ease-in-out" onclick='deleteInventoryItem("${item._id}")'>Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}
/**
 * Populates the inventory form for editing an item.
 * @param {string} id - The ID of the inventory item to edit.
 */
function editInventoryItem(id) {
    const itemToEdit = allInventory.find(item => item._id === id);
    if (!itemToEdit) {
        console.error('Item not found for editing:', id);
        return;
    }
    const tbody = document.getElementById('inventoryBody');
    const rowToReplace = Array.from(tbody.children).find(row => {
        return row.querySelector('button[onclick*="deleteInventoryItem"]').onclick.toString().includes(`"${id}"`);
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


/**
 * Saves the edited inventory item to the backend.
 * @param {string} id - The ID of the inventory item to save.
 */
async function saveInventoryItem(id) {
    const item = document.getElementById(`editItem-${id}`).value;
    const quantity = parseInt(document.getElementById(`editQuantity-${id}`).value);
    const lowStockLevel = parseInt(document.getElementById(`editLowstocklevel-${id}`).value);

    if (!item || isNaN(quantity)) {
        displayMessage('inventoryMessage', 'Please enter a valid item and quantity.', true);
        return;
    }
    
    try {
        const res = await fetch(`${backendURL}/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, quantity })
        });
        const result = await res.json();
        displayMessage('inventoryMessage', result.message || 'Inventory item updated successfully!');
        loadInventory();
    } catch (err) {
        console.error('Error saving inventory item:', err);
        displayMessage('inventoryMessage', 'An error occurred while saving the inventory item.', true);
    }
}


/**
 * Deletes an inventory item from the backend.
 * @param {string} id - The ID of the inventory item to delete.
 */
async function deleteInventoryItem(id) {
    if (!window.confirm("Are you sure you want to delete this inventory item?")) return;

    try {
        const res = await fetch(`${backendURL}/inventory/${id}`, {
            method: 'DELETE'
        });
        const result = await res.json();
        displayMessage('inventoryMessage', result.message || 'Inventory item deleted successfully!');
        loadInventory();
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        displayMessage('inventoryMessage', 'An error occurred while deleting the inventory item.', true);
    }
}

/**
 * Exports the inventory table to an Excel file.
 */
function exportInventoryToExcel() {
    const dataToExport = allInventory.map(item => ({
        'Item Name': item.item,
        'Stock Level': item.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Data");
    XLSX.writeFile(wb, "Hotel_Inventory.xlsx");
}

// Event listener for inventory search
document.getElementById('inventorySearch').addEventListener('input', renderInventoryTable);


// --- Initial Load ---
// Ensures that the main application content is hidden until login is successful.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mainApp').style.display = 'none';
});
