const API = 'api/students.php';
const ARCHIVE_API = 'api/archive.php';

const STAT_IDS = { active: 'statTotal', programs: 'statPrograms', archived: 'statArchived' };

const form = document.getElementById('studentForm');
const feedback = document.getElementById('feedback');
const tableBody = document.getElementById('tableBody');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const recordIdField = document.getElementById('recordId');
const searchInput = document.getElementById('searchInput');

let allStudents = [];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

let feedbackTimer;
function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = 'feedback ' + type;
  feedback.classList.remove('hidden');
  feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => feedback.classList.add('hidden'), type === 'error' ? 10000 : 4000);
}

async function api(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('Cannot reach the server. Open this page through http://localhost/ and make sure Apache and MySQL are running in XAMPP.');
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`Server returned an unexpected response (HTTP ${res.status}): ${snippet || 'empty response'}. PHP may not be running (Live Server on port 5500 cannot run PHP).`);
  }
}

function updateStats(students) {
  setText(STAT_IDS.active, students.length);
  setText(STAT_IDS.programs, new Set(students.map(s => String(s.program).trim().toLowerCase())).size);
}

async function loadArchiveCount() {
  try {
    const json = await api(ARCHIVE_API);
    if (!json.ok) throw new Error(json.error || 'Could not load archive.');
    setText(STAT_IDS.archived, json.data.length);
    return json;
  } catch (err) {
    setText(STAT_IDS.archived, '-');
    throw err;
  }
}

function renderStudents() {
  const q = searchInput.value.trim().toLowerCase();
  const list = q
    ? allStudents.filter(s =>
        [s.student_id, s.name, s.program].some(v => String(v ?? '').toLowerCase().includes(q)))
    : allStudents;

  setText('resultCount', q
    ? `${list.length} of ${allStudents.length} record${allStudents.length === 1 ? '' : 's'} match`
    : `${allStudents.length} record${allStudents.length === 1 ? '' : 's'}`);

  if (!list.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty">${q ? 'No matching records.' : 'No records yet.'}</td></tr>`;
    return;
  }

  tableBody.innerHTML = '';
  for (const s of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(s.id)}</td>
      <td>${esc(s.student_id)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.program)}</td>
      <td>${esc(s.updated_at)}</td>
      <td>
        <button class="small" onclick="editStudent(${Number(s.id)})">Edit</button>
        <button class="small danger" onclick="deleteStudent(${Number(s.id)})">Delete</button>
      </td>`;
    tableBody.appendChild(tr);
  }
}

async function loadStudents() {
  let json;
  try {
    json = await api(API);
    if (!json.ok) throw new Error(json.error || 'Could not load students.');
  } catch (err) {
    setText('resultCount', 'Could not load records');
    tableBody.innerHTML = `<tr><td colspan="6" class="empty">${esc(err.message)}</td></tr>`;
    return;
  }

  allStudents = json.data || [];
  updateStats(allStudents);
  renderStudents();
}

searchInput.addEventListener('input', renderStudents);

function resetForm() {
  form.reset();
  recordIdField.value = '';
  submitBtn.textContent = 'Create Record';
  cancelBtn.classList.add('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = recordIdField.value;
  const payload = {
    student_id: document.getElementById('student_id').value,
    name: document.getElementById('name').value,
    program: document.getElementById('program').value,
  };

  const url = id ? `${API}?id=${id}` : API;
  const method = id ? 'PUT' : 'POST';

  submitBtn.disabled = true;
  try {
    const json = await api(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (json.ok) {
      showFeedback(json.message, 'success');
      resetForm();
      loadStudents();
    } else {
      showFeedback(json.error || 'Something went wrong.', 'error');
    }
  } catch (err) {
    showFeedback(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

window.editStudent = async (id) => {
  try {
    const json = await api(`${API}?id=${id}`);
    if (!json.ok) return showFeedback(json.error, 'error');

    const s = json.data;
    recordIdField.value = s.id;
    document.getElementById('student_id').value = s.student_id;
    document.getElementById('name').value = s.name;
    document.getElementById('program').value = s.program;
    submitBtn.textContent = 'Update Record';
    cancelBtn.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    showFeedback(err.message, 'error');
  }
};

cancelBtn.addEventListener('click', resetForm);

window.deleteStudent = async (id) => {
  if (!confirm('Archive (soft-delete) this student record?')) return;
  try {
    const json = await api(`${API}?id=${id}`, { method: 'DELETE' });
    if (json.ok) {
      showFeedback(json.message, 'success');
      loadStudents();
      const section = document.getElementById('archiveSection');
      if (section && !section.classList.contains('hidden')) renderArchive();
      else loadArchiveCount().catch(() => {});
    } else {
      showFeedback(json.error, 'error');
    }
  } catch (err) {
    showFeedback(err.message, 'error');
  }
};

async function renderArchive() {
  const body = document.getElementById('archiveBody');
  try {
    const json = await loadArchiveCount();
    body.innerHTML = json.data.length
      ? json.data.map(a => `
        <tr>
          <td>${esc(a.archive_id)}</td>
          <td>${esc(a.student_id)}</td>
          <td>${esc(a.name)}</td>
          <td>${esc(a.program)}</td>
          <td>${esc(a.deleted_at)}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="empty">No archived records.</td></tr>';
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="empty">${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('showArchive').addEventListener('click', () => {
  const section = document.getElementById('archiveSection');
  section.classList.toggle('hidden');
  if (!section.classList.contains('hidden')) renderArchive();
});

setText('todayDate', new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
setText('year', new Date().getFullYear());

loadStudents();
loadArchiveCount().catch(() => {});