const $ = s => document.querySelector(s);
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function api(url, options={}) {
  const response = await fetch(url, {headers:{'Content-Type':'application/json', ...(options.headers || {})}, ...options});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
function showAdmin(loggedIn) {
  $('#login-panel').classList.toggle('hidden', loggedIn);
  $('#manage-panel').classList.toggle('hidden', !loggedIn);
  if (loggedIn) loadAdminBooks();
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#login-error').textContent = '';
  try {
    await api('/api/admin/login', {method:'POST', body:JSON.stringify({password:$('#admin-password').value})});
    showAdmin(true);
  } catch (error) { $('#login-error').textContent = error.message; }
});
$('#logout-btn').addEventListener('click', async () => { await api('/api/admin/logout', {method:'POST', body:'{}'}); showAdmin(false); });
$('#book-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(e.target), data = Object.fromEntries(form.entries());
  ['year','copies','available'].forEach(key => data[key] = data[key] === '' ? null : Number(data[key]));
  try {
    await api('/api/admin/books', {method:'POST', body:JSON.stringify(data)});
    $('#admin-message').textContent = 'Book added successfully.';
    e.target.reset(); e.target.elements.category.value = 'General'; e.target.elements.copies.value = '1'; e.target.elements.available.value = '1';
    loadAdminBooks();
  } catch (error) { $('#admin-message').textContent = error.message; }
});
async function loadAdminBooks() {
  try {
    const data = await api('/api/books');
    $('#admin-books').innerHTML = data.books.map(book => `
      <div class="admin-book-row"><div><strong>${esc(book.title)}</strong><small>${esc(book.author)} · ${esc(book.category)} · ${book.available}/${book.copies} available</small></div>
      <div class="admin-book-actions"><input aria-label="Available copies for ${esc(book.title)}" type="number" min="0" max="${book.copies}" value="${book.available}" id="available-${book.id}"><button onclick="saveAvailability(${book.id}, ${book.copies})">Save</button><button onclick="removeBook(${book.id})">Delete</button></div></div>`).join('') || '<p>No books in catalog.</p>';
  } catch (error) { $('#admin-books').textContent = error.message; }
}
window.saveAvailability = async (id, copies) => {
  const value = Number($(`#available-${id}`).value);
  if (!Number.isInteger(value) || value < 0 || value > copies) { $('#admin-message').textContent = `Available copies must be between 0 and ${copies}.`; return; }
  try { await api(`/api/admin/books/${id}/availability`, {method:'PUT', body:JSON.stringify({available:value})}); $('#admin-message').textContent = 'Availability updated.'; loadAdminBooks(); }
  catch (error) { $('#admin-message').textContent = error.message; }
};
window.removeBook = async id => {
  if (!confirm('Delete this book from the catalog?')) return;
  try { await api(`/api/admin/books/${id}`, {method:'DELETE'}); $('#admin-message').textContent = 'Book deleted.'; loadAdminBooks(); }
  catch (error) { $('#admin-message').textContent = error.message; }
};
(async () => {
  try { await api('/api/books'); } catch {}
  // A lightweight session check: protected admin data responds 401 unless signed in.
  try { await api('/api/admin/session'); showAdmin(true); } catch { showAdmin(false); }
})();
