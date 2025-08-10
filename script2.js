// script.js
const backendURL = 'https://roomcheckbackend-grf6.onrender.com';

// --- DOM Element References ---
const loginSection = document.getElementById('loginSection');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('messageDiv');
const usernameSpan = document.getElementById('usernameSpan');
const logoutBtn = document.getElementById('logoutBtn');

// Tab buttons
const tabChecklistBtn = document.getElementById('tabChecklist');
const tabHousekeepingBtn = document.getElementById('tabHousekeeping');
const tabInventoryBtn = document.getElementById('tabInventory');
const tabAuditLogBtn = document.getElementById('tabAuditLog');

// Tab content sections
const roomChecklistSection = document.getElementById('roomChecklistSection');
const housekeepingReportSection = document.getElementById('housekeepingReportSection');
const inventorySection = document.getElementById('inventorySection');
const auditLogSection = document.getElementById('auditLogSection');

// Forms and message areas
const checklistForm = document.getElementById('checklistForm');
const checklistMessage = document.getElementById('checklistMessage');
const housekeepingForm = document.getElementById('housekeepingForm');
const housekeepingMessage = document.getElementById('housekeepingMessage');
const addInventoryForm = document.getElementById('addInventoryForm');
const inventoryMessage = document.getElementById('inventoryMessage');
const auditLogMessage = document.getElementById('auditLogMessage');

// Tables
const checklistTableBody = document.getElementById('checklistTableBody');
const statusReportTableBody = document.getElementById('statusReportTableBody');
const inventoryTableBody = document.getElementById('inventoryBody');
const auditLogTableBody = document.getElementById('auditLogTableBody');

let currentUser = null; // Store the current user's name

// --- Utility Functions ---

/**
 * Displays a message in a specified message area.
 * @param {string} elementId - The ID of the message element.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if the message is an error.
 */
function displayMessage(elementId, message, isError = false) {
    const messageElement = document.getElementById(elementId);
    messageElement.textContent = message;
    messageElement.className = `mt-4 text-center font-bold ${isError ? 'text-red-500' : 'text-green-500'}`;
    setTimeout(() => {
        messageElement.textContent = '';
    }, 5000);
}

/**
 * Handles tab switching.
 * @param {string} tabName - The name of the tab to show ('checklist', 'housekeeping', 'inventory', 'audit').
 */
function showTab(tabName) {
    const allTabs = [roomChecklistSection, housekeepingReportSection, inventorySection, auditLogSection];
    const allButtons = [tabChecklistBtn, tabHousekeepingBtn, tabInventoryBtn, tabAuditLogBtn];

    // Hide all tab content and reset button styles
    allTabs.forEach(section => section.classList.add('hidden'));
    allButtons.forEach(btn => btn.classList.remove('bg-blue-600', 'text-white'));
    allButtons.forEach(btn => btn.classList.add('bg-gray-200', 'text-gray-700'));

    // Show the selected tab and style its button
    switch (tabName) {
        case 'checklist':
            roomChecklistSection.classList.remove('hidden');
            tabChecklistBtn.classList.remove('bg-gray-200', 'text-gray-700');
            tabChecklistBtn.classList.add('bg-blue-600', 'text-white');
            loadChecklists();
            break;
        case 'housekeeping':
            housekeepingReportSection.classList.remove('hidden');
            tabHousekeepingBtn.classList.remove('bg-gray-200', 'text-gray-700');
            tabHousekeepingBtn.classList.add('bg-blue-600', 'text-white');
            loadStatusReports();
            break;
        case 'inventory':
            inventorySection.classList.remove('hidden');
            tabInventoryBtn.classList.remove('bg-gray-200', 'text-gray-700');
            tabInventoryBtn.classList.add('bg-blue-600', 'text-white');
            loadInventory();
            break;
        case 'audit':
            auditLogSection.classList.remove('hidden');
            tabAuditLogBtn.classList.remove('bg-gray-200', 'text-gray-700');
            tabAuditLogBtn.classList.add('bg-blue-600', 'text-white');
            loadAuditLogs();
            break;
    }
}

// --- Login/Logout Functionality ---

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${backendURL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await res.json();
        if (res.ok) {
            currentUser = username;
            localStorage.setItem('user', currentUser);
            usernameSpan.textContent = currentUser;
            loginSection.classList.add('hidden');
            mainApp.classList.remove('hidden');
            showTab('checklist'); // Show default tab
        } else {
            displayMessage('messageDiv', result.message, true);
        }
    } catch (err) {
        console.error('Login error:', err);
        displayMessage('messageDiv', 'Failed to connect to the server. Please try again.', true);
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await fetch(`${backendURL}/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
    } catch (err) {
        console.error('Logout logging failed:', err);
    }
    currentUser = null;
    localStorage.removeItem('user');
    loginSection.classList.remove('hidden');
    mainApp.classList.add('hidden');
    loginForm.reset();
    displayMessage('messageDiv', 'You have been logged out.');
});

// Check for existing session on page load
window.addEventListener('load', () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        currentUser = storedUser;
        usernameSpan.textContent = currentUser;
        loginSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        showTab('checklist');
    }
});

// --- Tab Button Event Listeners ---
tabChecklistBtn.addEventListener('click', () => showTab('checklist'));
tabHousekeepingBtn.addEventListener('click', () => showTab('housekeeping'));
tabInventoryBtn.addEventListener('click', () => showTab('inventory'));
tabAuditLogBtn.addEventListener('click', () => showTab('audit'));

// --- Room Checklist Functionality ---

checklistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const room = formData.get('room');
    const date = formData.get('date');
    const items = {};
    for (const [key, value] of formData.entries()) {
        if (key !== 'room' && key !== 'date') {
            items[key] = value;
        }
    }

    const data = { room, date, items, user: currentUser };

    try {
        const res = await fetch(`${backendURL}/submit-checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            displayMessage('checklistMessage', 'Checklist submitted successfully!');
            e.target.reset();
            loadChecklists();
        } else {
            displayMessage('checklistMessage', result.message, true);
        }
    } catch (err) {
        console.error('Error submitting checklist:', err);
        displayMessage('checklistMessage', 'Failed to submit checklist. Server error.', true);
    }
});

async function loadChecklists() {
    try {
        const res = await fetch(`${backendURL}/checklists`);
        if (!res.ok) throw new Error('Failed to fetch checklists');
        const checklists = await res.json();
        renderChecklists(checklists);
    } catch (err) {
        console.error('Error loading checklists:', err);
        displayMessage('checklistMessage', 'Failed to load checklists.', true);
    }
}

function renderChecklists(checklists) {
    checklistTableBody.innerHTML = '';
    checklists.forEach(list => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';
        tr.innerHTML = `
            <td class="border px-4 py-2">${list.room}</td>
            <td class="border px-4 py-2">${list.date}</td>
            <td class="border px-4 py-2">
                <button onclick="viewChecklistDetails('${list._id}')" class="text-blue-600 hover:text-blue-800">View Details</button>
            </td>
        `;
        checklistTableBody.appendChild(tr);
    });
}

// --- Housekeeping Report Functionality ---

housekeepingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.dateTime = new Date().toISOString();
    data.user = currentUser;

    try {
        const res = await fetch(`${backendURL}/submit-status-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            displayMessage('housekeepingMessage', 'Status report submitted successfully!');
            e.target.reset();
            loadStatusReports();
        } else {
            displayMessage('housekeepingMessage', result.message, true);
        }
    } catch (err) {
        console.error('Error submitting status report:', err);
        displayMessage('housekeepingMessage', 'Failed to submit report. Server error.', true);
    }
});

async function loadStatusReports() {
    try {
        const res = await fetch(`${backendURL}/status-reports`);
        if (!res.ok) throw new Error('Failed to fetch status reports');
        const reports = await res.json();
        renderStatusReports(reports);
    } catch (err) {
        console.error('Error loading status reports:', err);
        displayMessage('housekeepingMessage', 'Failed to load status reports.', true);
    }
}

function renderStatusReports(reports) {
    statusReportTableBody.innerHTML = '';
    reports.forEach(report => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';
        tr.innerHTML = `
            <td class="border px-4 py-2">${report.room}</td>
            <td class="border px-4 py-2">${report.category}</td>
            <td class="border px-4 py-2">${report.status}</td>
            <td class="border px-4 py-2">${new Date(report.dateTime).toLocaleString()}</td>
        `;
        statusReportTableBody.appendChild(tr);
    });
}

// --- Inventory Management Functionality ---
let allInventory = [];

addInventoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.quantity = parseInt(data.quantity);
    data.lowStockThreshold = parseInt(data.lowStockThreshold);
    data.user = currentUser;

    try {
        const res = await fetch(`${backendURL}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        displayMessage('inventoryMessage', result.message);
        e.target.reset();
        loadInventory();
    } catch (err) {
        console.error('Error adding inventory item:', err);
        displayMessage('inventoryMessage', 'Failed to add item. It may already exist.', true);
    }
});

async function loadInventory() {
    try {
        const res = await fetch(`${backendURL}/inventory`);
        if (!res.ok) throw new Error('Failed to fetch inventory');
        allInventory = await res.json();
        renderInventoryTable();
    } catch (err) {
        console.error('Error loading inventory:', err);
        displayMessage('inventoryMessage', 'Failed to load inventory.', true);
    }
}

function renderInventoryTable() {
    inventoryTableBody.innerHTML = '';
    if (allInventory.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No inventory items found.</td></tr>';
        return;
    }

    allInventory.forEach(item => {
        const isLowStock = item.quantity < item.lowStockThreshold;
        const rowColor = isLowStock ? 'bg-red-100' : 'bg-white';
        const stockStatus = isLowStock ? '<span class="font-bold text-red-600">Low Stock!</span>' : 'In Stock';

        const tr = document.createElement('tr');
        tr.className = rowColor;
        tr.innerHTML = `
            <td class="border px-4 py-2">${item.item}</td>
            <td class="border px-4 py-2">${item.quantity} (${stockStatus})</td>
            <td class="border px-4 py-2">${item.lowStockThreshold}</td>
            <td class="border px-4 py-2">
                <input type="number" id="useQuantity-${item._id}" value="1" min="1" class="w-16 px-2 py-1 border rounded-md" />
                <button onclick="useInventoryItem('${item._id}')" class="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600">Use</button>
                <button onclick="deleteInventoryItem('${item._id}')" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600">Delete</button>
            </td>
        `;
        inventoryTableBody.appendChild(tr);
    });
}

async function useInventoryItem(id) {
    const quantityToUse = parseInt(document.getElementById(`useQuantity-${id}`).value);
    if (isNaN(quantityToUse) || quantityToUse <= 0) {
        displayMessage('inventoryMessage', 'Please enter a valid quantity to use.', true);
        return;
    }
    
    try {
        const res = await fetch(`${backendURL}/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: quantityToUse, user: currentUser })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        displayMessage('inventoryMessage', `Used ${quantityToUse} item(s).`, false);
        loadInventory();
    } catch (err) {
        console.error('Error using inventory item:', err);
        displayMessage('inventoryMessage', 'Failed to update inventory. Check if the quantity is available.', true);
    }
}

async function deleteInventoryItem(id) {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;
    try {
        const res = await fetch(`${backendURL}/inventory/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser }) // Send user for logging
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        displayMessage('inventoryMessage', result.message);
        loadInventory();
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        displayMessage('inventoryMessage', 'Failed to delete item.', true);
    }
}

// --- Audit Log Functionality ---
async function loadAuditLogs() {
    try {
        const res = await fetch(`${backendURL}/audit-logs`);
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        const logs = await res.json();
        renderAuditLogs(logs);
    } catch (err) {
        console.error('Error loading audit logs:', err);
        displayMessage('auditLogMessage', 'Failed to load audit logs.', true);
    }
}

function renderAuditLogs(logs) {
    auditLogTableBody.innerHTML = '';
    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = log.status === 'FAILURE' ? 'bg-red-100' : 'bg-green-100';
        tr.innerHTML = `
            <td class="border px-4 py-2">${new Date(log.timestamp).toLocaleString()}</td>
            <td class="border px-4 py-2">${log.user}</td>
            <td class="border px-4 py-2">${log.action}</td>
            <td class="border px-4 py-2">${log.status}</td>
            <td class="border px-4 py-2">${JSON.stringify(log.details)}</td>
        `;
        auditLogTableBody.appendChild(tr);
    });
}
