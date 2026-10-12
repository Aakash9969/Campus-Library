import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "college-library";
const BOOKS_KEY = "books";
const DEFAULT_BOOKS = [
  {id:1,title:"Clean Code",author:"Robert C. Martin",category:"Programming",isbn:"9780132350884",year:2008,copies:4,available:3,description:"A handbook of agile software craftsmanship, with practical guidance for writing readable and maintainable code."},
  {id:2,title:"Introduction to Algorithms",author:"Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein",category:"Computer Science",isbn:"9780262046305",year:2022,copies:3,available:1,description:"A comprehensive textbook covering algorithms, data structures, graph algorithms, dynamic programming, and complexity."},
  {id:3,title:"The Pragmatic Programmer",author:"Andrew Hunt and David Thomas",category:"Programming",isbn:"9780135957059",year:2019,copies:2,available:2,description:"Practical advice and techniques for improving software development skills and building robust systems."},
  {id:4,title:"Database System Concepts",author:"Abraham Silberschatz, Henry F. Korth, S. Sudarshan",category:"Database",isbn:"9780078022159",year:2019,copies:5,available:4,description:"An introduction to database systems, SQL, transactions, indexing, normalization, and database design."},
  {id:5,title:"Artificial Intelligence: A Modern Approach",author:"Stuart Russell and Peter Norvig",category:"Artificial Intelligence",isbn:"9780134610993",year:2021,copies:2,available:0,description:"A broad introduction to AI, search, knowledge representation, machine learning, reasoning, and intelligent agents."},
  {id:6,title:"The Design of Everyday Things",author:"Don Norman",category:"Design",isbn:"9780465050659",year:2013,copies:2,available:1,description:"Explains human-centered design, usability, feedback, affordances, and how to design products people can use."},
  {id:7,title:"Cosmos",author:"Carl Sagan",category:"Science",isbn:"9780345539434",year:2013,copies:3,available:2,description:"An accessible exploration of astronomy, the origins of life, and humanity's place in the universe."},
  {id:8,title:"Deep Work",author:"Cal Newport",category:"Productivity",isbn:"9781455586691",year:2016,copies:2,available:2,description:"Strategies for focused work, reducing distraction, and producing meaningful results."}
];

const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", ...extraHeaders}
});
const cookieValue = (header, name) => {
  const found = (header || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
};
const secret = () => process.env.SESSION_SECRET || process.env.SECRET_KEY || "";
const sign = value => crypto.createHmac("sha256", secret()).update(value).digest("hex");
function validAdmin(req) {
  if (!secret()) return false;
  const token = cookieValue(req.headers.get("cookie"), "library_admin");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.admin === true && decoded.exp > Date.now();
  } catch { return false; }
}
function adminCookie(req) {
  const payload = Buffer.from(JSON.stringify({admin:true, exp:Date.now() + 8 * 60 * 60 * 1000})).toString("base64url");
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `library_admin=${encodeURIComponent(payload + "." + sign(payload))}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${secure}`;
}
function clearCookie(req) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `library_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}
async function getBooks() {
  const store = getStore(STORE_NAME);
  let books = await store.get(BOOKS_KEY, {type:"json"});
  if (!Array.isArray(books)) {
    books = DEFAULT_BOOKS;
    await store.setJSON(BOOKS_KEY, books);
  }
  return books;
}
async function saveBooks(books) {
  const store = getStore(STORE_NAME);
  await store.setJSON(BOOKS_KEY, books);
}
function searchBooks(books, query="", category="") {
  const q = String(query).trim().toLowerCase();
  const cat = String(category).trim().toLowerCase();
  return books.filter(b => {
    const haystack = [b.title,b.author,b.category,b.isbn,b.description].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (!cat || b.category.toLowerCase() === cat);
  }).sort((a,b) => a.title.localeCompare(b.title));
}
function tokens(s) { return new Set(String(s || "").toLowerCase().match(/[a-z0-9]+/g) || []); }
function answerQuestion(message, books) {
  const msg = String(message || "").trim();
  if (!msg) return {answer:"Type a question about books, authors, subjects, or availability.", books:[]};
  const lower = msg.toLowerCase();
  if (/\b(hello|hi|hey|good morning|good afternoon)\b/.test(lower))
    return {answer:"Hi! I'm your college library assistant. Ask me to find a book, check availability, explore a subject, or recommend something to read.",books:[]};
  const stop = new Set(["the","a","an","is","are","do","does","can","i","me","my","you","your","for","of","to","in","on","about","book","books","find","show","want","need","have","any","please","what","which","who","available"]);
  const wanted = [...tokens(msg)].filter(t => !stop.has(t));
  const ranked = books.map(b => {
    const all = tokens([b.title,b.author,b.category,b.isbn,b.description].join(" "));
    return {b,score:wanted.filter(t => all.has(t)).length};
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score || a.b.title.localeCompare(b.b.title)).slice(0,5);
  const matches = ranked.map(x => x.b);
  if (/\b(available|borrow|issue|checkout|copies|in stock)\b/.test(lower)) {
    if (!matches.length) return {answer:"I couldn't match that to a title in the current catalog. Try the book title, author, or subject.",books:[]};
    const available = matches.filter(b => b.available > 0);
    return {answer:available.length ? "Here are matching books that are currently available: " + available.slice(0,4).map(b => `${b.title} (${b.available} available)`).join(", ") + "." : "I found matching titles, but they currently have no available copies. Ask library staff about return dates.",books:matches};
  }
  if (/\b(recommend|suggest|what should|beginner|learn)\b/.test(lower))
    return matches.length ? {answer:"Based on your question, these catalog titles may be useful. Check each description and availability below.",books:matches} : {answer:"Tell me a subject such as programming, databases, AI, science, or productivity, and I'll suggest matching catalog titles.",books:[]};
  if (matches.length) return {answer:`I found ${matches.length} relevant title(s) in the library catalog. Here are the closest matches, including descriptions and availability.`,books:matches};
  if (/\b(category|subject|subjects|catalog)\b/.test(lower))
    return {answer:"The current catalog includes: " + [...new Set(books.map(b => b.category))].sort().join(", ") + ". Ask for a subject or a specific title to see matching books.",books:[]};
  return {answer:"I couldn't find a confident match in the current catalog. Try a title, author, ISBN, or subject. I can answer using books currently stored in this catalog.",books:[]};
}

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();

    if (path === "/api/health" && method === "GET") return json({ok:true,service:"college-library-chatbot-netlify"});
    if (path === "/api/admin/login" && method === "POST") {
      const data = await req.json().catch(() => ({}));
      if (!process.env.ADMIN_PASSWORD || !secret()) return json({ok:false,error:"Set ADMIN_PASSWORD and SESSION_SECRET in Netlify environment variables."},500);
      if (data.password && data.password === process.env.ADMIN_PASSWORD)
        return json({ok:true},200,{"Set-Cookie":adminCookie(req)});
      return json({ok:false,error:"Incorrect admin password"},401);
    }
    if (path === "/api/admin/logout" && method === "POST")
      return json({ok:true},200,{"Set-Cookie":clearCookie(req)});
    if (path === "/api/admin/session" && method === "GET")
      return validAdmin(req) ? json({ok:true}) : json({error:"Admin login required"},401);

    const books = await getBooks();
    if (path === "/api/books" && method === "GET") {
      const found = searchBooks(books,url.searchParams.get("q") || "",url.searchParams.get("category") || "");
      return json({books:found,count:found.length});
    }
    if (path === "/api/categories" && method === "GET")
      return json({categories:[...new Set(books.map(b => b.category))].sort()});
    if (path === "/api/chat" && method === "POST") {
      const data = await req.json().catch(() => ({}));
      return json(answerQuestion(String(data.message || "").slice(0,1000),books));
    }

    const match = path.match(/^\/api\/admin\/books(?:\/(\d+)(?:\/availability)?)?$/);
    if (match) {
      if (!validAdmin(req)) return json({error:"Admin login required"},401);
      const id = match[1] ? Number(match[1]) : null;
      const isAvailability = path.endsWith("/availability");
      if (path === "/api/admin/books" && method === "POST") {
        const data = await req.json().catch(() => ({}));
        const title = String(data.title || "").trim(), author = String(data.author || "").trim();
        if (!title || !author) return json({error:"Title and author are required"},400);
        const copies = Math.max(0,Number.parseInt(data.copies ?? 1,10) || 0);
        const available = Math.max(0,Math.min(copies,Number.parseInt(data.available ?? copies,10) || 0));
        const year = data.year ? Number.parseInt(data.year,10) : null;
        const nextId = Math.max(0,...books.map(b => Number(b.id)||0)) + 1;
        books.push({id:nextId,title,author,category:String(data.category || "General").trim() || "General",isbn:String(data.isbn || "").trim(),year,copies,available,description:String(data.description || "").trim()});
        await saveBooks(books);
        return json({ok:true,id:nextId},201);
      }
      if (id !== null && isAvailability && method === "PUT") {
        const data = await req.json().catch(() => ({}));
        const book = books.find(b => b.id === id);
        if (!book) return json({error:"Book not found"},404);
        const n = Number(data.available);
        if (!Number.isInteger(n) || n < 0) return json({error:"Available must be a non-negative number"},400);
        book.available = Math.min(n,book.copies);
        await saveBooks(books);
        return json({ok:true,available:book.available});
      }
      if (id !== null && !isAvailability && method === "DELETE") {
        const idx = books.findIndex(b => b.id === id);
        if (idx < 0) return json({error:"Book not found"},404);
        books.splice(idx,1);
        await saveBooks(books);
        return json({ok:true});
      }
    }
    return json({error:"Not found"},404);
  } catch (error) {
    console.error("Library API error:", error);
    return json({error:"The library service encountered an error. Check Netlify function logs and environment variables."},500);
  }
};

export const config = {
  path: [
    "/api/health",
    "/api/books",
    "/api/categories",
    "/api/chat",
    "/api/admin/login",
    "/api/admin/logout",
    "/api/admin/session",
    "/api/admin/books",
    "/api/admin/books/:id",
    "/api/admin/books/:id/availability"
  ]
};
