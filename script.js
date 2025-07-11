
  const backendURL = 'https://roomcheckbackend.onrender.com';
  let allChecklists = [];
  let currentPage = 1;
  const rowsPerPage = 5;

  // Function to export table data to Excel
  function exportToExcel() {
    const table = document.getElementById("checklistTable");
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklist Data");
    XLSX.writeFile(wb, "Hotel_Room_Checklist.xlsx");
  }

  document.getElementById('checklistForm').addEventListener('submit', function (e) {
    e.preventDefault();

    (async () => {
      const room = document.getElementById('room').value;
      const date = document.getElementById('date').value;

      if (!room || !date) {
        document.getElementById('message').textContent = 'Please select a room and date.';
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

        document.getElementById('message').textContent = result.message || 'Checklist submitted.';

        if (result.emailSent) {
          document.getElementById('message').textContent += ' Email sent for missing items.';
        }

        e.target.reset(); // Reset the form after successful submission
        loadChecklists(); // Reload checklists to show the new entry
      } catch (err) {
        console.error('Error:', err);
        document.getElementById('message').textContent = 'An error occurred while submitting.';
      }
    })();
  });

  async function loadChecklists() {
    try {
      const res = await fetch(`${backendURL}/checklists`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      allChecklists = await res.json();
      renderTable();
    } catch (err) {
      console.error('Error loading checklists:', err);
      document.getElementById('message').textContent = 'Failed to load checklists.';
    }
  }

  async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
      const res = await fetch(`${backendURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });

      if (res.ok) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        loadChecklists(); // Load data after successful login
      } else {
        document.getElementById('loginMsg').textContent = 'Invalid username or password.';
      }
    } catch (err) {
      console.error('Login error:', err);
      document.getElementById('loginMsg').textContent = 'Server error during login.';
    }
  }

  function renderTable() {
    const tbody = document.getElementById('checklistBody');
    const search = document.getElementById('searchInput').value.toLowerCase();

    // Filter data
    const filtered = allChecklists.filter(entry =>
      entry.room.toLowerCase().includes(search) ||
      entry.date.toLowerCase().includes(search)
    );

    // Pagination
    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);

    tbody.innerHTML = '';
    paginated.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.room}</td>
        <td>${entry.date}</td>
        <td>${Object.entries(entry.items).map(([k,v]) => `${k}: ${v}`).join(', ')}</td>
        <td>
          <button class="btn" onclick='editChecklist(${JSON.stringify(entry)})'>Edit</button>
          <button class="btn" onclick='deleteChecklist("${entry._id}")'>Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Update pagination
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${Math.ceil(filtered.length / rowsPerPage)}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = start + rowsPerPage >= filtered.length;
  }

  function editChecklist(entry) {
    const tbody = document.getElementById('checklistBody');
    // Find the row of the item being edited to replace it, or add a new editing row
    const existingRow = Array.from(tbody.children).find(row => row.children[0].textContent === entry.room && row.children[1].textContent === entry.date);

    const editRowHtml = `
      <tr class="edit-row">
        <td><input id="editRoom" value="${entry.room}" /></td>
        <td><input id="editDate" type="date" value="${entry.date}" /></td>
        <td>
          ${Object.keys(entry.items).map(key => `
            ${key}:
            <select id="item-${key}">
              <option value="yes" ${entry.items[key] === 'yes' ? 'selected' : ''}>yes</option>
              <option value="no" ${entry.items[key] === 'no' ? 'selected' : ''}>no</option>
            </select><br>
          `).join('')}
        </td>
        <td>
          <button class="btn" onclick="saveChecklist('${entry._id}')">Save</button>
          <button class="btn" onclick="loadChecklists()">Cancel</button>
        </td>
      </tr>
    `;

    if (existingRow) {
      existingRow.outerHTML = editRowHtml;
    } else {
      // This case should ideally not happen if edit is clicked on an existing row
      // but as a fallback, we can prepend it or handle as needed
      tbody.insertAdjacentHTML('afterbegin', editRowHtml);
    }
  }

  async function saveChecklist(id) {
    const room = document.getElementById('editRoom').value;
    const date = document.getElementById('editDate').value;

    const itemElements = document.querySelectorAll('[id^="item-"]');
    const items = {};
    itemElements.forEach(el => {
      const key = el.id.replace('item-', '');
      items[key] = el.value;
    });

    try {
      const res = await fetch(`${backendURL}/checklists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, date, items })
      });

      const result = await res.json();
      alert(result.message);
      await loadChecklists();
    } catch (err) {
      console.error('Error saving checklist:', err);
      alert('An error occurred while saving the checklist.');
    }
  }

  async function deleteChecklist(id) {
    if (!confirm("Are you sure you want to delete this checklist?")) return;

    try {
      const res = await fetch(`${backendURL}/checklists/${id}`, {
        method: 'DELETE'
      });

      const result = await res.json();
      alert(result.message);
      await loadChecklists();
    } catch (err) {
      console.error('Error deleting checklist:', err);
      alert('An error occurred while deleting the checklist.');
    }
  }

  document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    renderTable();
  });

  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  document.getElementById('nextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(allChecklists.filter(entry =>
      entry.room.toLowerCase().includes(document.getElementById('searchInput').value.toLowerCase()) ||
      entry.date.toLowerCase().includes(document.getElementById('searchInput').value.toLowerCase())
    ).length / rowsPerPage);

    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  // Initially hide the main application content
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mainApp').style.display = 'none';
  });
