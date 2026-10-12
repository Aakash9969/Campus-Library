const $ = (selector) => document.querySelector(selector);
const messages = $('#messages');
const chatForm = $('#chat-form');
const chatInput = $('#chat-input');
const bookGrid = $('#book-grid');
const searchInput = $('#search-books');
const categoryFilter = $('#category-filter');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function addMessage(text, who, books = []) {
  const wrap = document.createElement('div');
  wrap.className = `message ${who}`;
  let html = `<div class="bubble">${escapeHtml(text)}</div>`;
  if (books.length) {
    html += '<div class="chat-book-list">' + books.map(book => `
      <div class="chat-book"><strong>${escapeHtml(book.title)}</strong>
      <small>${escapeHtml(book.author)} · ${escapeHtml(book.category)}${book.year ? ' · ' + escapeHtml(book.year) : ''}</small>
      <small>${escapeHtml(book.description)}</small>
      <small class="${book.available > 0 ? 'available' : 'unavailable'}">${book.available > 0 ? `${book.available} of ${book.copies} copies available` : 'Currently unavailable'}</small></div>`).join('') + '</div>';
  }
  html += `<span class="message-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>`;
  wrap.innerHTML = html;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
}
async function sendMessage(text) {
  if (!text.trim()) return;
  addMessage(text, 'user');
  chatInput.value = '';
  chatInput.disabled = true;
  const pending = document.createElement('div');
  pending.className = 'message assistant';
  pending.innerHTML = '<div class="bubble">Searching the catalog…</div>';
  messages.appendChild(pending);
  messages.scrollTop = messages.scrollHeight;
  try {
    const response = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:text})});
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    pending.remove();
    addMessage(data.answer, 'assistant', data.books || []);
  } catch (error) {
    pending.remove();
    addMessage('Sorry, I could not reach the library service. Check that the backend is running and try again.', 'assistant');
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
}
chatForm.addEventListener('submit', e => {e.preventDefault(); sendMessage(chatInput.value);});
// Delegate suggestion clicks so the pre-made chat prompts keep working reliably.
document.addEventListener('click', event => {
  const button = event.target.closest('[data-prompt]');
  if (!button) return;
  event.preventDefault();
  const prompt = button.getAttribute('data-prompt');
  if (prompt) sendMessage(prompt);
});

function renderBooks(books) {
  $('#result-count').textContent = `${books.length} title${books.length === 1 ? '' : 's'} found`;
  if (!books.length) { bookGrid.innerHTML = '<div class="empty-state">No matching books found. Try another search or subject.</div>'; return; }
  bookGrid.innerHTML = books.map(book => `
    <article class="book-card">
      <div class="book-cover">${escapeHtml(book.title.slice(0,1).toUpperCase())}</div>
      <span class="category-pill">${escapeHtml(book.category)}</span>
      <h3>${escapeHtml(book.title)}</h3><div class="book-author">${escapeHtml(book.author)}</div>
      <p class="book-description">${escapeHtml(book.description || 'No description available.')}</p>
      <div class="book-meta"><span>${book.year ? escapeHtml(book.year) : 'Year n/a'}</span><span class="${book.available > 0 ? 'available' : 'unavailable'}">${book.available > 0 ? `${book.available} available` : 'Unavailable'}</span></div>
    </article>`).join('');
}
let searchTimer;
async function loadBooks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (categoryFilter.value) params.set('category', categoryFilter.value);
  try {
    const response = await fetch(`/api/books?${params}`);
    const data = await response.json();
    renderBooks(data.books);
  } catch { bookGrid.innerHTML = '<div class="empty-state">Could not load books. Is the backend running?</div>'; }
}
searchInput.addEventListener('input', () => {clearTimeout(searchTimer); searchTimer = setTimeout(loadBooks, 220);});
categoryFilter.addEventListener('change', loadBooks);
async function initialize() {
  try {
    const [booksResponse, categoriesResponse] = await Promise.all([fetch('/api/books'), fetch('/api/categories')]);
    const booksData = await booksResponse.json();
    const categoriesData = await categoriesResponse.json();
    $('#book-count').textContent = booksData.count;
    categoriesData.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category; option.textContent = category; categoryFilter.appendChild(option);
    });
    renderBooks(booksData.books);
  } catch { $('#book-count').textContent = '—'; bookGrid.innerHTML = '<div class="empty-state">Could not load catalog.</div>'; }
}
initialize();
