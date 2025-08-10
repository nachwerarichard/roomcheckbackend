// Base URL for the backend API
const API_BASE_URL = 'https://roomcheckbackend-grf6.onrender.com';

// Global data arrays
let allChecklists = [];
let allHousekeepingReports = [];
let allInventoryItems = [];
let allAuditLogs = [];
let currentUser = null; // Store the logged-in user

// Pagination state for each tab
const rowsPerPage = 5;
const paginationState = {
    checklists: { currentPage: 1, totalPages: 1 },
    housekeeping: { currentPage: 1, totalPages: 1 },
    inventory: { currentPage: 1, totalPages: 1 },
    auditLog: { currentPage: 1, totalPages: 1 }
};

// --- Custom Modal Functions (replaces alert and confirm) ---
const modalContainer = document.getElementById('modalContainer');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalButtons = document.getElementById('modalButtons');

function showModal(title, message, buttons) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = '';
    buttons.forEach(btnConfig => {
        const button = document.createElement('button');
        button.textContent = btnConfig.text;
        button.className = `py-2 px-4 rounded-md font-semibold transition-colors ${btnConfig.class || 'bg-gray-300 hover:bg-gray-400'}`;
        button.onclick = () => {
            btnConfig.action();
            hideModal();
        };
        modalButtons.appendChild(button);
    });
    modalContainer.classList.remove('hidden');
}

function hideModal() {
    modalContainer.classList.add('hidden');
}

// --- Data Fetching Functions (API Calls) ---

// Generic fetch function with error handling
async function fetchData(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        return await response.json();
    } catch (e) {
        console.error(`Error fetching data from ${endpoint}:`, e);
        showModal('Error', `Failed to connect to the server or process data. Please try again.`, [{ text: 'OK', action: () => {} }]);
        return null;
    }
}

// Fetch all checklists
async function fetchChecklists() {
    const data = await fetchData('checklists');
    if (data) {
        allChecklists = data;
        renderChecklistTable();
    }
}

// Add a new checklist
async function addChecklist(data) {
    const response = await fetchData('checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, user: currentUser })
    });
    if (response) {
        document.getElementById('checklistMessage').textContent = 'Checklist submitted successfully.';
        fetchChecklists(); // Refresh the table
    } else {
        document.getElementById('checklistMessage').textContent = 'Failed to submit checklist.';
    }
}

// Delete a checklist
async function deleteChecklist(id) {
    const response = await fetchData(`checklists/${id}`, {
        method: 'DELETE'
    });
    if (response) {
        fetchChecklists(); // Refresh the table
    }
}

// Fetch all housekeeping reports
async function fetchHousekeepingReports() {
    const data = await fetchData('reports');
    if (data) {
        allHousekeepingReports = data;
        renderHousekeepingTable();
    }
}

// Add a new housekeeping report
async function addHousekeepingReport(data) {
    const response = await fetchData('reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, user: currentUser, timestamp: new Date().toISOString() })
    });
    if (response) {
        document.getElementById('housekeepingMessage').textContent = 'Housekeeping report submitted successfully.';
        fetchHousekeepingReports(); // Refresh the table
    } else {
        document.getElementById('housekeepingMessage').textContent = 'Failed to submit report.';
    }
}

// Delete a housekeeping report
async function deleteHousekeepingReport(id) {
    const response = await fetchData(`reports/${id}`, {
        method: 'DELETE'
    });
    if (response) {
        fetchHousekeepingReports(); // Refresh the table
    }
}

// Fetch all inventory items
async function fetchInventoryItems() {
    const data = await fetchData('inventory');
    if (data) {
        allInventoryItems = data;
        renderInventoryTable();
    }
}

// Add a new inventory item
async function addInventoryItem(data) {
    const response = await fetchData('inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, user: currentUser })
    });
    if (response) {
        document.getElementById('inventoryMessage').textContent = `Item '${data.item}' added successfully.`;
        fetchInventoryItems(); // Refresh the table
    } else {
        document.getElementById('inventoryMessage').textContent = 'Failed to add item.';
    }
}

// Delete an inventory item
async function deleteInventoryItem(id) {
    const response = await fetchData(`inventory/${id}`, {
        method: 'DELETE'
    });
    if (response) {
        fetchInventoryItems(); // Refresh the table
    }
}

// Fetch all audit logs
async function fetchAuditLogs() {
    const data = await fetchData('audit-logs');
    if (data) {
        // Sort logs by timestamp descending
        allAuditLogs = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderAuditLogTable();
    }
}


// --- UI Rendering Functions ---
function renderChecklistTable() {
    const tbody = document.getElementById('checklistTableBody');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allChecklists.filter(entry =>
        (entry.room && entry.room.toLowerCase().includes(searchInput)) ||
        (entry.date && entry.date.toLowerCase().includes(searchInput)) ||
        (entry.user && entry.user.toLowerCase().includes(searchInput))
    );

    const start = (paginationState.checklists.currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);
    paginationState.checklists.totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;

    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No checklists found.</td></tr>';
    } else {
        paginated.forEach(entry => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            const items = entry.items ? Object.entries(entry.items).map(([k, v]) => `<span class="capitalize">${k.replace(/_/g, ' ')}</span>: ${v}`).join(', ') : '';
            tr.innerHTML = `
                <td class="px-4 py-2">${entry.room}</td>
                <td class="px-4 py-2">${entry.date}</td>
                <td class="px-4 py-2">${items}</td>
                <td class="px-4 py-2">
                    <button onclick="deleteChecklist('${entry.id}')" class="py-1 px-3 bg-red-500 text-white rounded-md text-sm hover:bg-red-600">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('checklistCurrentPageSpan').textContent = paginationState.checklists.currentPage;
    document.getElementById('checklistTotalPagesSpan').textContent = paginationState.checklists.totalPages;
    document.getElementById('checklistPrevBtn').disabled = paginationState.checklists.currentPage === 1;
    document.getElementById('checklistNextBtn').disabled = paginationState.checklists.currentPage >= paginationState.checklists.totalPages;
}

function renderHousekeepingTable() {
    const tbody = document.getElementById('statusReportTableBody');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allHousekeepingReports.filter(report =>
        (report.room && report.room.toLowerCase().includes(searchInput)) ||
        (report.category && report.category.toLowerCase().includes(searchInput)) ||
        (report.status && report.status.toLowerCase().includes(searchInput))
    );

    const start = (paginationState.housekeeping.currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);
    paginationState.housekeeping.totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;

    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No reports found.</td></tr>';
    } else {
        paginated.forEach(report => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            const statusColor = report.status === 'Completed' ? 'bg-green-100 text-green-800' : report.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
            const timestamp = report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A';
            tr.innerHTML = `
                <td class="px-4 py-2">${report.room}</td>
                <td class="px-4 py-2">${report.category}</td>
                <td class="px-4 py-2"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusColor}">${report.status}</span></td>
                <td class="px-4 py-2 text-sm">${timestamp}</td>
                <td class="px-4 py-2">
                    <button onclick="deleteHousekeepingReport('${report.id}')" class="py-1 px-3 bg-red-500 text-white rounded-md text-sm hover:bg-red-600">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('housekeepingCurrentPageSpan').textContent = paginationState.housekeeping.currentPage;
    document.getElementById('housekeepingTotalPagesSpan').textContent = paginationState.housekeeping.totalPages;
    document.getElementById('housekeepingPrevBtn').disabled = paginationState.housekeeping.currentPage === 1;
    document.getElementById('housekeepingNextBtn').disabled = paginationState.housekeeping.currentPage >= paginationState.housekeeping.totalPages;
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allInventoryItems.filter(item =>
        (item.item && item.item.toLowerCase().includes(searchInput))
    );

    const start = (paginationState.inventory.currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);
    paginationState.inventory.totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;

    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No inventory items found.</td></tr>';
    } else {
        paginated.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            const statusText = item.quantity <= item.lowStockThreshold ? 'Low Stock' : 'In Stock';
            const statusColor = item.quantity <= item.lowStockThreshold ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            tr.innerHTML = `
                <td class="px-4 py-2">${item.item}</td>
                <td class="px-4 py-2">${item.quantity}</td>
                <td class="px-4 py-2">${item.lowStockThreshold}</td>
                <td class="px-4 py-2"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusColor}">${statusText}</span></td>
                <td class="px-4 py-2">
                    <button onclick="deleteInventoryItem('${item.id}')" class="py-1 px-3 bg-red-500 text-white rounded-md text-sm hover:bg-red-600">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('inventoryCurrentPageSpan').textContent = paginationState.inventory.currentPage;
    document.getElementById('inventoryTotalPagesSpan').textContent = paginationState.inventory.totalPages;
    document.getElementById('inventoryPrevBtn').disabled = paginationState.inventory.currentPage === 1;
    document.getElementById('inventoryNextBtn').disabled = paginationState.inventory.currentPage >= paginationState.inventory.totalPages;
}

function renderAuditLogTable() {
    const tbody = document.getElementById('auditLogTableBody');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allAuditLogs.filter(log =>
        (log.user && log.user.toLowerCase().includes(searchInput)) ||
        (log.action && log.action.toLowerCase().includes(searchInput)) ||
        (log.details && log.details.toLowerCase().includes(searchInput))
    );

    const start = (paginationState.auditLog.currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);
    paginationState.auditLog.totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;

    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No audit logs found.</td></tr>';
    } else {
        paginated.forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            const statusColor = log.status === 'success' ? 'text-green-600' : 'text-red-600';
            const timestamp = new Date(log.timestamp).toLocaleString();
            tr.innerHTML = `
                <td class="px-4 py-2 text-sm">${timestamp}</td>
                <td class="px-4 py-2 text-sm">${log.user}</td>
                <td class="px-4 py-2 text-sm">${log.action}</td>
                <td class="px-4 py-2 text-sm font-semibold ${statusColor}">${log.status}</td>
                <td class="px-4 py-2 text-sm">${log.details}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('auditLogCurrentPageSpan').textContent = paginationState.auditLog.currentPage;
    document.getElementById('auditLogTotalPagesSpan').textContent = paginationState.auditLog.totalPages;
    document.getElementById('auditLogPrevBtn').disabled = paginationState.auditLog.currentPage === 1;
    document.getElementById('auditLogNextBtn').disabled = paginationState.auditLog.currentPage >= paginationState.auditLog.totalPages;
}

// --- Event Handlers ---

// Main login handler
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const loginMessage = document.getElementById('loginMessage');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username && password) {
        loginMessage.textContent = 'Logging in...';
        // Mocking a login, as a real auth flow would be more complex
        currentUser = username;
        document.getElementById('usernameSpan').textContent = username; // Display the username
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        await fetchChecklists(); // Load initial data
        loginMessage.textContent = '';
        addAuditLog('User Login', `User '${username}' logged in successfully.`);
    } else {
        loginMessage.textContent = 'Please enter a valid username and password.';
        addAuditLog('User Login', `Login attempt failed for user '${username}'.`, 'error');
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    addAuditLog('User Logout', `User logged out.`);
    currentUser = null;
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
});

// Tab switching logic
function switchTab(tabId, fetchDataFunc) {
    const sections = ['roomChecklistSection', 'housekeepingReportSection', 'inventorySection', 'auditLogSection'];
    const tabs = ['tabChecklist', 'tabHousekeeping', 'tabInventory', 'tabAuditLog'];

    sections.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    tabs.forEach(id => {
        document.getElementById(id).classList.remove('tab-active');
    });

    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(`tab${tabId.replace('Section', '')}`).classList.add('tab-active');

    // Fetch data for the new tab
    fetchDataFunc();
}

document.getElementById('tabChecklist').addEventListener('click', () => switchTab('roomChecklistSection', fetchChecklists));
document.getElementById('tabHousekeeping').addEventListener('click', () => switchTab('housekeepingReportSection', fetchHousekeepingReports));
document.getElementById('tabInventory').addEventListener('click', () => switchTab('inventorySection', fetchInventoryItems));
document.getElementById('tabAuditLog').addEventListener('click', () => switchTab('auditLogSection', fetchAuditLogs));

// Form submission handlers
document.getElementById('checklistForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        room: formData.get('room'),
        date: formData.get('date'),
        items: {
            towels: formData.get('towels'),
            bed_linen: formData.get('bed_linen'),
            toiletries: formData.get('toiletries'),
            toilet_paper: formData.get('toilet_paper')
        }
    };
    addChecklist(data);
    e.target.reset();
});

document.getElementById('housekeepingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        room: formData.get('room'),
        category: formData.get('category'),
        status: formData.get('status'),
        remarks: formData.get('remarks')
    };
    addHousekeepingReport(data);
    e.target.reset();
});

document.getElementById('addInventoryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        item: formData.get('item'),
        quantity: formData.get('quantity'),
        lowStockThreshold: formData.get('lowStockThreshold')
    };
    addInventoryItem(data);
    e.target.reset();
});

// Pagination handlers (Note: these operate on the currently fetched data)
document.getElementById('checklistPrevBtn').addEventListener('click', () => {
    if (paginationState.checklists.currentPage > 1) {
        paginationState.checklists.currentPage--;
        renderChecklistTable();
    }
});
document.getElementById('checklistNextBtn').addEventListener('click', () => {
    if (paginationState.checklists.currentPage < paginationState.checklists.totalPages) {
        paginationState.checklists.currentPage++;
        renderChecklistTable();
    }
});

document.getElementById('housekeepingPrevBtn').addEventListener('click', () => {
    if (paginationState.housekeeping.currentPage > 1) {
        paginationState.housekeeping.currentPage--;
        renderHousekeepingTable();
    }
});
document.getElementById('housekeepingNextBtn').addEventListener('click', () => {
    if (paginationState.housekeeping.currentPage < paginationState.housekeeping.totalPages) {
        paginationState.housekeeping.currentPage++;
        renderHousekeepingTable();
    }
});

document.getElementById('inventoryPrevBtn').addEventListener('click', () => {
    if (paginationState.inventory.currentPage > 1) {
        paginationState.inventory.currentPage--;
        renderInventoryTable();
    }
});
document.getElementById('inventoryNextBtn').addEventListener('click', () => {
    if (paginationState.inventory.currentPage < paginationState.inventory.totalPages) {
        paginationState.inventory.currentPage++;
        renderInventoryTable();
    }
});

document.getElementById('auditLogPrevBtn').addEventListener('click', () => {
    if (paginationState.auditLog.currentPage > 1) {
        paginationState.auditLog.currentPage--;
        renderAuditLogTable();
    }
});
document.getElementById('auditLogNextBtn').addEventListener('click', () => {
    if (paginationState.auditLog.currentPage < paginationState.auditLog.totalPages) {
        paginationState.auditLog.currentPage++;
        renderAuditLogTable();
    }
});

// Global search handler
document.getElementById('searchInput').addEventListener('input', () => {
    Object.values(paginationState).forEach(state => state.currentPage = 1);
    const activeSection = document.querySelector('section:not(.hidden)').id;
    if (activeSection === 'roomChecklistSection') renderChecklistTable();
    if (activeSection === 'housekeepingReportSection') renderHousekeepingTable();
    if (activeSection === 'inventorySection') renderInventoryTable();
    if (activeSection === 'auditLogSection') renderAuditLogTable();
});

// Export to Excel handler
document.getElementById('exportChecklistBtn').addEventListener('click', function() {
    const dataToExport = allChecklists.map(item => {
        const flatItems = {};
        for (const key in item.items) {
            flatItems[key] = item.items[key];
        }
        return { Room: item.room, Date: item.date, ...flatItems };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklist Data");
    XLSX.writeFile(wb, "Hotel_Room_Checklist.xlsx");
});

// --- Initial Setup ---
// The app will now start on a login page and only load data after a successful login.
window.onload = function() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
};
