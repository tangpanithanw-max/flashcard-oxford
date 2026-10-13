// =============================================================
// app.js : การทำงานทั้งหมดของเว็บแฟลชการ์ด
// =============================================================

// -------------------------------------------------------------
// 1) ค่า Firebase config (นำมาจาก Firebase Console ในขั้นที่ 2)
//    ค่าพวกนี้ "ใส่ในโค้ดและขึ้น GitHub ได้" เพราะเป็นค่าสาธารณะ
//    ใช้บอกว่าเว็บนี้คุยกับโปรเจกต์ Firebase ไหน ไม่ใช่รหัสลับ
//    ความปลอดภัยจริงมาจาก Firestore Security Rules
//    ❌ ห้ามใส่: Service account key (.json), รหัสผ่านของคุณ, Admin SDK key
// -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCR_9HsiyElbYmwvEGv0ndUGh24CJPlkwo",
  authDomain: "flashcard-oxford.firebaseapp.com",
  projectId: "flashcard-oxford",
  storageBucket: "flashcard-oxford.firebasestorage.app",
  messagingSenderId: "823114634289",
  appId: "1:823114634289:web:042d14cab45dd37d36f110",
  measurementId: "G-8RLT6MV4VB"
};

// ถ้ายังไม่ได้ใส่ config เว็บยังใช้งานได้ แต่จะปิดระบบล็อกอินไว้
const firebaseReady =
  typeof firebase !== "undefined" && !firebaseConfig.apiKey.startsWith("ใส่ค่า");

let auth = null;
let db = null;
if (firebaseReady) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

// -------------------------------------------------------------
// 2) สถานะของแอป
// -------------------------------------------------------------
const LEVELS = ["A1", "A2", "B1", "B2"];
// แยกที่เก็บในเครื่องตามผู้ใช้ เช่น "flashcard-progress-<uid>"
// เครื่องเดียวกันใช้หลายบัญชีได้ ข้อมูลไม่ปนกัน
const STORAGE_PREFIX = "flashcard-progress-";
const GOAL_PREFIX = "flashcard-goal-";
const STREAK_PREFIX = "flashcard-streak-";
const SETTINGS_KEY = "flashcard-settings";
const DAY_MS = 24 * 60 * 60 * 1000;

// progress เก็บสถานะของแต่ละคำ เช่น
// { "book|noun": { s: "known", t: 1700000000000 } }
//   s = "known"    จำได้แล้ว
//       "learning" ยังจำไม่ได้
//       "new"      ยังไม่เปิด (ใช้ตอนลบคำออกจากลิสต์ ให้กลับไปเป็นคำใหม่)
//       ถ้าไม่มีข้อมูลของคำนั้นเลย ก็ถือว่า "ยังไม่เปิด" เหมือนกัน
//   t = เวลาที่กดล่าสุด ใช้ตัดสินว่าข้อมูลไหนใหม่กว่าตอนรวมข้อมูลจากหลายเครื่อง
let progress = {};
let currentUser = null;

// goal = เป้าหมายรายวัน หรือ null ถ้าไม่ได้ตั้ง
// { start: เวลาที่ตั้ง, targets: { A1: 10, A2: 10 }, counts: { A1: 3, A2: 0 },
//   done: บรรลุแล้วหรือยัง, t: เวลาที่แก้ล่าสุด }
let goal = null;
// streak = วันที่เล่นติดกัน { current: 3, longest: 5, last: "2026-10-13", t }
let streak = { current: 0, longest: 0, last: "", t: 0 };

// mode = "learn"  เรียนคำใหม่ (โชว์เฉพาะคำที่ยังไม่เปิด)
//        "review" ทวน (โชว์เฉพาะคำที่ยังจำไม่ได้)
//        "search" กำลังดูคำที่ค้นหา (การ์ดเดียว)
let mode = "learn";
let modeBeforeSearch = "learn";
let selectedLevel = "ALL";
let deck = [];        // รายการคำที่กำลังแสดงอยู่ (หลังกรองแล้ว)
let index = 0;        // ตำแหน่งการ์ดปัจจุบันใน deck
let shuffled = true;  // สุ่มลำดับการ์ดเสมอ
let round = null;     // สรุปรอบทวน { total, known, again }
let history = [];     // ประวัติการกด ไว้ใช้ปุ่ม "เลิกทำล่าสุด" (เก็บ 20 ครั้งล่าสุด)

// ลิสต์คำ
let listTab = "known";   // "known" หรือ "learning"
let listLevel = "ALL";
let listChecked = new Set();

// ใช้ word + pos เป็นรหัสของคำ เพราะบางคำมีหลายชนิด (เช่น "book" noun / verb)
function wordKey(w) {
  return w.word + "|" + w.pos;
}
// สถานะของคำ: "known" | "learning" | "new"
function statusOf(w) {
  const s = progress[wordKey(w)]?.s;
  return s === "known" || s === "learning" ? s : "new";
}
function byLevel(words, lv) {
  return lv === "ALL" ? words : words.filter((w) => w.level === lv);
}

// -------------------------------------------------------------
// 3) ดึง element จากหน้าเว็บ
// -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  card: $("card"), counter: $("counter"), empty: $("emptyBox"),
  word: $("wordText"), pos: $("posText"), levelTag: $("levelTag"), statusTag: $("statusTag"),
  meaning: $("meaningText"), example: $("exampleText"), exampleTh: $("exampleThText"),
  accent: $("accentSelect"), speed: $("speedSelect"),
  voiceNotice: $("voiceNotice"), stats: $("statsList"), sync: $("syncStatus"),
  userLabel: $("userLabel"), logoutBtn: $("logoutBtn"), streak: $("streakBadge"),
  reviewPill: $("reviewPill"), banner: $("modeBanner"),
  undo: $("undoBtn"), search: $("searchInput"), searchResults: $("searchResults"),
  goalBox: $("goalBox"), goalModal: $("goalModal"), goalForm: $("goalForm"),
  goalRows: $("goalRows"), goalFormMsg: $("goalFormMsg"),
  doneModal: $("doneModal"), doneText: $("doneText"),
  tabKnown: $("tabKnown"), tabLearning: $("tabLearning"),
  listActions: $("listActions"), wordList: $("wordList"),
  // 3 หน้าจอหลัก: กำลังโหลด / เข้าสู่ระบบ-สมัคร / เล่นแฟลชการ์ด
  loadingScreen: $("loadingScreen"), authScreen: $("authScreen"), appScreen: $("appScreen"),
  loginView: $("loginView"), registerView: $("registerView"),
  loginEmail: $("loginEmail"), loginPassword: $("loginPassword"), loginMsg: $("loginMessage"),
  registerEmail: $("registerEmail"), registerPassword: $("registerPassword"),
  registerConfirm: $("registerConfirm"), registerMsg: $("registerMessage")
};

// -------------------------------------------------------------
// 4) localStorage: สำเนาข้อมูลในเครื่อง
//    ช่วยให้เปิดเว็บแล้วเห็นข้อมูลทันที และไม่หายถ้าเน็ตหลุดระหว่างกด
// -------------------------------------------------------------
function localKey(prefix) {
  return prefix + (currentUser ? currentUser.uid : "none");
}
function loadLocal(prefix, fallback) {
  try {
    return JSON.parse(localStorage.getItem(localKey(prefix))) ?? fallback;
  } catch (e) {
    return fallback; // ถ้าข้อมูลเสียหรือเบราว์เซอร์ปิด localStorage ก็เริ่มใหม่
  }
}
function saveLocal(prefix, value) {
  try {
    localStorage.setItem(localKey(prefix), JSON.stringify(value));
  } catch (e) { /* โหมดไม่ระบุตัวตนบางเบราว์เซอร์อาจบันทึกไม่ได้ */ }
}

// -------------------------------------------------------------
// 5) จัดชุดการ์ดตามโหมดและระดับ
// -------------------------------------------------------------
function buildDeck() {
  const wanted = mode === "review" ? "learning" : "new";
  deck = byLevel(WORDS, selectedLevel).filter((w) => statusOf(w) === wanted);
  if (shuffled) shuffleArray(deck);
  index = 0;
  round = mode === "review" ? { total: deck.length, known: 0, again: 0 } : null;
  render();
}

// สุ่มลำดับแบบ Fisher–Yates: สลับตำแหน่งจากท้ายมาหน้า ทำให้ทุกลำดับมีโอกาสเท่ากัน
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function setMode(m) {
  mode = m;
  history = [];
  // หน้าทวนเป็นอีกหน้า: ซ่อนส่วนของหน้าเรียนคำใหม่ (ค้นหา เป้าหมาย สถิติ ลิสต์)
  const wasReview = el.appScreen.classList.contains("reviewing");
  el.appScreen.classList.toggle("reviewing", m === "review");
  if (wasReview !== (m === "review")) window.scrollTo(0, 0);
  buildDeck();
}

function setLevel(lv) {
  selectedLevel = lv;
  document.querySelectorAll("#levelButtons .level-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.level === lv));
  if (mode === "search") mode = modeBeforeSearch;
  setMode(mode);
}

// -------------------------------------------------------------
// 6) แสดงผลการ์ด
// -------------------------------------------------------------
function render() {
  el.card.classList.remove("flipped");
  const hasCards = deck.length > 0;
  el.card.classList.toggle("hidden", !hasCards);
  el.empty.classList.toggle("hidden", hasCards);
  ["knownBtn", "unknownBtn", "prevBtn", "nextBtn"].forEach((id) => ($(id).disabled = !hasCards));
  el.undo.disabled = history.length === 0;

  // แถบบอกโหมดตอนดูคำที่ค้นหา
  el.banner.classList.toggle("hidden", mode !== "search");
  if (mode === "search") {
    el.banner.textContent = "กำลังดูคำที่ค้นหา · กดจำได้/ยังไม่จำ หรือกดเลือกระดับด้านบนเพื่อกลับไปเล่นต่อ";
  }

  if (hasCards) {
    const w = deck[index];
    // ใช้ textContent (ไม่ใช้ innerHTML) เพื่อกันโค้ดแปลกๆ ในข้อมูลคำศัพท์
    el.word.textContent = w.word;
    el.pos.textContent = w.pos;
    el.levelTag.textContent = w.level;
    el.meaning.textContent = w.meaning;
    el.example.textContent = w.example;
    el.exampleTh.textContent = w.exampleTh || ""; // คำไหนยังไม่มีคำแปล บรรทัดนี้จะว่าง

    const st = statusOf(w);
    el.statusTag.className = "status-tag" + (st !== "new" ? " " + st : "");
    el.statusTag.textContent = st === "known" ? "จำได้แล้ว" : st === "learning" ? "ยังจำไม่ได้" : "";
    const label = mode === "review" ? "ทวน" : mode === "search" ? "คำที่ค้นหา" : "คำใหม่";
    el.counter.textContent = `${label} ${index + 1} / ${deck.length}`;
  } else {
    el.counter.textContent = "";
    renderEmpty();
  }
  const c = computeCounts();
  el.reviewPill.textContent = `🔁 ทวน (${c.ALL.learning})`;
  renderStats(c);
  renderGoal();
  renderList(c);
}

// ข้อความตอนการ์ดหมด: สรุปรอบทวน หรือบอกว่าเรียนครบแล้ว
function renderEmpty() {
  el.empty.textContent = "";
  const p = document.createElement("p");
  const lvText = selectedLevel === "ALL" ? "ทุกระดับ" : "ระดับ " + selectedLevel;
  if (mode === "review" && round && round.total > 0) {
    p.textContent = `จบรอบทวนแล้ว 🎉 จำได้เพิ่ม ${round.known} คำ · ยังจำไม่ได้ ${round.again} คำ`;
    el.empty.appendChild(p);
    if (countStatus(selectedLevel, "learning") > 0) {
      el.empty.appendChild(makeButton("ทวนอีกรอบ", "btn primary", () => buildDeck()));
    }
  } else if (mode === "review") {
    p.textContent = `ไม่มีคำที่ยังจำไม่ได้ใน${lvText} 👍`;
    el.empty.appendChild(p);
  } else {
    p.textContent = `เปิดครบทุกคำใน${lvText}แล้ว 🎉 ไปทวนคำที่ยังจำไม่ได้ต่อได้เลย`;
    el.empty.appendChild(p);
    el.empty.appendChild(makeButton("🔁 ไปโหมดทวน", "btn primary", () => setMode("review")));
  }
}

function makeButton(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.onclick = onClick;
  return b;
}

// -------------------------------------------------------------
// 7) สถิติ: จำได้แล้ว / ยังจำไม่ได้ / ยังไม่เปิด ของแต่ละระดับ
// -------------------------------------------------------------
function countStatus(lv, status) {
  return byLevel(WORDS, lv).filter((w) => statusOf(w) === status).length;
}
// นับทุกระดับในรอบเดียว: { A1: { known, learning, new, total }, ..., ALL: {...} }
function computeCounts() {
  const c = {};
  [...LEVELS, "ALL"].forEach((lv) => (c[lv] = { known: 0, learning: 0, new: 0, total: 0 }));
  WORDS.forEach((w) => {
    const st = statusOf(w);
    [w.level, "ALL"].forEach((lv) => { c[lv][st]++; c[lv].total++; });
  });
  return c;
}

function renderStats(c) {
  el.stats.textContent = "";
  [...LEVELS, "ALL"].forEach((lv) => {
    const { total, known, learning } = c[lv];
    const fresh = c[lv].new;
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `<div class="stat-label"><b></b><span></span></div>
                     <div class="bar"><div class="bar-fill known"></div><div class="bar-fill learning"></div></div>
                     <div class="stat-detail"></div>`;
    row.querySelector("b").textContent = lv === "ALL" ? "รวมทั้งหมด" : lv;
    row.querySelector(".stat-label span").textContent =
      `จำได้ ${known} / ${total} คำ (${total ? Math.round((known / total) * 100) : 0}%)`;
    row.querySelector(".bar-fill.known").style.width = (total ? (known / total) * 100 : 0) + "%";
    row.querySelector(".bar-fill.learning").style.width = (total ? (learning / total) * 100 : 0) + "%";
    row.querySelector(".stat-detail").textContent =
      `✅ จำได้ ${known} · ❌ ยังจำไม่ได้ ${learning} · ⚪ ยังไม่เปิด ${fresh}`;
    el.stats.appendChild(row);
  });
}

// -------------------------------------------------------------
// 8) กด จำได้แล้ว / ยังไม่จำ
// -------------------------------------------------------------
function mark(status) {
  if (!deck.length) return;
  const w = deck[index];
  const key = wordKey(w);
  const entry = {
    key, word: w, index, mode, status,
    prev: progress[key] ? { ...progress[key] } : null,
    goalLevel: null
  };

  progress[key] = { s: status, t: Date.now() };
  saveLocal(STORAGE_PREFIX, progress);
  saveCloudWords([key]);
  touchStreak();

  // นับเข้าเป้าหมาย: เฉพาะคำใหม่จากโหมดเรียนคำใหม่ และอยู่ในระดับที่ตั้งเป้าไว้
  if (mode === "learn" && activeGoal() && goal.targets[w.level]) {
    goal.counts[w.level] = (goal.counts[w.level] || 0) + 1;
    entry.goalLevel = w.level;
    goalChanged();
    checkGoalDone();
  }

  history.push(entry);
  if (history.length > 20) history.shift();

  if (mode === "search") {
    // ดูคำที่ค้นหาเสร็จแล้ว กลับไปโหมดเดิม
    mode = modeBeforeSearch;
    setMode(mode);
    return;
  }
  if (mode === "review") {
    if (status === "known") round.known++; else round.again++;
  }
  // คำที่กดแล้วจะออกจากชุดนี้ (โหมดเรียน: ไม่ใช่คำใหม่แล้ว, โหมดทวน: ทวนคำนี้ในรอบนี้แล้ว)
  deck.splice(index, 1);
  if (index >= deck.length) index = 0;
  render();
}

// ปุ่ม "เลิกทำล่าสุด": คืนสถานะคำเดิม และเอาการ์ดกลับมาที่เดิม
function undo() {
  const h = history.pop();
  if (!h) return;
  // ถ้าก่อนกดยังไม่มีข้อมูล ให้กลับเป็น "ยังไม่เปิด"
  progress[h.key] = h.prev ? { ...h.prev, t: Date.now() } : { s: "new", t: Date.now() };
  saveLocal(STORAGE_PREFIX, progress);
  saveCloudWords([h.key]);

  if (h.goalLevel && activeGoal()) {
    goal.counts[h.goalLevel] = Math.max(0, (goal.counts[h.goalLevel] || 0) - 1);
    goalChanged();
  }
  // ถ้ายังอยู่โหมดเดิม เอาการ์ดใบนั้นกลับมาที่ตำแหน่งเดิม
  if (h.mode === mode && mode !== "search") {
    deck.splice(Math.min(h.index, deck.length), 0, h.word);
    index = Math.min(h.index, deck.length - 1);
    if (mode === "review" && round) {
      if (h.status === "known") round.known = Math.max(0, round.known - 1);
      else round.again = Math.max(0, round.again - 1);
    }
  }
  render();
}

function next() {
  if (!deck.length) return;
  index = (index + 1) % deck.length;
  render();
}
function prev() {
  if (!deck.length) return;
  index = (index - 1 + deck.length) % deck.length;
  render();
}

// -------------------------------------------------------------
// 9) เป้าหมายรายวัน
//    ตั้งได้หลายระดับพร้อมกัน อยู่ได้ 24 ชั่วโมงนับจากตอนกดตั้ง
//    นับเฉพาะคำใหม่ที่กดในโหมด "เรียนคำใหม่" (กดจำได้หรือยังไม่จำก็นับ)
// -------------------------------------------------------------
function activeGoal() {
  return goal && Date.now() - goal.start < DAY_MS;
}

// บันทึกเป้าหมายลงเครื่องและขึ้นคลาวด์ทุกครั้งที่เปลี่ยน
function goalChanged() {
  if (goal) goal.t = Date.now();
  saveLocal(GOAL_PREFIX, goal);
  saveCloudField("goal", goal);
}

function checkGoalDone() {
  if (!activeGoal() || goal.done) return;
  const allDone = Object.entries(goal.targets).every(([lv, n]) => (goal.counts[lv] || 0) >= n);
  if (!allDone) return;
  goal.done = true;
  goalChanged();
  const total = Object.values(goal.targets).reduce((a, b) => a + b, 0);
  el.doneText.textContent = `วันนี้เรียนคำใหม่ครบ ${total} คำตามเป้าแล้ว จะตั้งเป้าหมายใหม่ หรือเล่นต่อสบายๆ ก็ได้`;
  el.doneModal.classList.remove("hidden");
}

function renderGoal() {
  const box = el.goalBox;
  box.textContent = "";
  const head = document.createElement("div");
  head.className = "goal-head";
  const title = document.createElement("b");
  head.appendChild(title);
  box.appendChild(head);

  if (!activeGoal()) {
    title.textContent = "🎯 ยังไม่ได้ตั้งเป้าหมาย";
    head.appendChild(makeButton("ตั้งเป้าหมาย", "btn small primary", openGoalModal));
    return;
  }

  const left = goal.start + DAY_MS - Date.now();
  const hours = Math.floor(left / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  title.textContent = goal.done ? "🎉 บรรลุเป้าหมายแล้ว" : "🎯 เป้าหมาย";
  const time = document.createElement("span");
  time.className = "goal-time";
  time.textContent = `เหลือเวลา ${hours} ชม. ${mins} นาที`;
  head.appendChild(time);

  LEVELS.filter((lv) => goal.targets[lv]).forEach((lv) => {
    const n = goal.targets[lv];
    const c = Math.min(goal.counts[lv] || 0, n);
    const row = document.createElement("div");
    row.className = "goal-row";
    row.innerHTML = `<span class="goal-lv"></span><div class="bar"><div class="bar-fill known"></div></div><span class="goal-num"></span>`;
    row.querySelector(".goal-lv").textContent = lv;
    row.querySelector(".bar-fill").style.width = (c / n) * 100 + "%";
    row.querySelector(".goal-num").textContent = `${c} / ${n}`;
    box.appendChild(row);
  });

  const btns = document.createElement("div");
  btns.className = "goal-buttons";
  if (goal.done) btns.appendChild(makeButton("ตั้งเป้าหมายใหม่", "btn small primary", openGoalModal));
  btns.appendChild(makeButton("ลบเป้าหมาย", "btn small", () => {
    if (!confirm("ลบเป้าหมายนี้ใช่ไหม?")) return;
    goal = null;
    goalChanged();
    render();
  }));
  box.appendChild(btns);
}

// หน้าต่างตั้งเป้าหมาย: ติ๊กเลือกระดับ + ใส่จำนวนคำ
function openGoalModal() {
  el.doneModal.classList.add("hidden");
  el.goalRows.textContent = "";
  el.goalFormMsg.textContent = "";
  LEVELS.forEach((lv) => {
    const left = countStatus(lv, "new");
    const row = document.createElement("label");
    row.className = "goal-pick";
    row.innerHTML = `<input type="checkbox"> <b></b> <input type="number" min="1" step="1" value="10" disabled> <span>คำ</span> <small></small>`;
    const [check, num] = row.querySelectorAll("input");
    check.dataset.level = lv;
    num.dataset.level = lv;
    row.querySelector("b").textContent = lv;
    row.querySelector("small").textContent = `(เหลือคำใหม่ ${left})`;
    check.onchange = () => (num.disabled = !check.checked);
    el.goalRows.appendChild(row);
  });
  el.goalModal.classList.remove("hidden");
}

el.goalForm.onsubmit = (e) => {
  e.preventDefault();
  const targets = {};
  el.goalRows.querySelectorAll('input[type="checkbox"]').forEach((c) => {
    if (!c.checked) return;
    const n = parseInt(el.goalRows.querySelector(`input[type="number"][data-level="${c.dataset.level}"]`).value, 10);
    if (n > 0) targets[c.dataset.level] = n;
  });
  if (!Object.keys(targets).length) {
    el.goalFormMsg.textContent = "ติ๊กเลือกอย่างน้อย 1 ระดับ และใส่จำนวนคำมากกว่า 0";
    return;
  }
  goal = { start: Date.now(), targets, counts: {}, done: false };
  goalChanged();
  el.goalModal.classList.add("hidden");
  render();
};
$("goalCancel").onclick = () => el.goalModal.classList.add("hidden");
$("doneContinue").onclick = () => el.doneModal.classList.add("hidden");
$("doneNewGoal").onclick = openGoalModal;

// -------------------------------------------------------------
// 10) นับวันที่เล่นติดกัน 🔥 (นับเมื่อกดจำได้/ยังไม่จำอย่างน้อย 1 คำในวันนั้น)
// -------------------------------------------------------------
function dateStr(d) {
  // วันที่ตามเวลาในเครื่อง เช่น "2026-10-13"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return dateStr(new Date()); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d); }

function touchStreak() {
  const today = todayStr();
  if (streak.last === today) return;
  streak.current = streak.last === yesterdayStr() ? streak.current + 1 : 1;
  streak.longest = Math.max(streak.longest || 0, streak.current);
  streak.last = today;
  streak.t = Date.now();
  saveLocal(STREAK_PREFIX, streak);
  saveCloudField("streak", streak);
  renderStreak();
}
function renderStreak() {
  // ถ้าวันล่าสุดที่เล่นเก่ากว่าเมื่อวาน แปลว่าขาดไปแล้ว นับเป็น 0
  const alive = streak.last === todayStr() || streak.last === yesterdayStr();
  const n = alive ? streak.current : 0;
  el.streak.textContent = `🔥 ${n} วัน`;
  el.streak.title = `เล่นติดกัน ${n} วัน (สถิติสูงสุด ${streak.longest || 0} วัน)` +
    (streak.last === todayStr() ? "" : " · วันนี้ยังไม่ได้เล่น");
  el.streak.classList.toggle("off", streak.last !== todayStr());
}

// -------------------------------------------------------------
// 11) ค้นหาคำ: พิมพ์อังกฤษ = หาคำที่ขึ้นต้นด้วยตัวอักษรนั้น, พิมพ์ไทย = หาในความหมาย
// -------------------------------------------------------------
function searchWords(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const thai = /[฀-๿]/.test(q);
  const hits = WORDS.filter((w) => thai ? w.meaning.includes(q) : w.word.toLowerCase().startsWith(q));
  // คำที่ตรงเป๊ะขึ้นก่อน
  if (!thai) hits.sort((a, b) => (b.word.toLowerCase() === q) - (a.word.toLowerCase() === q));
  return hits.slice(0, 20);
}

function renderSearch() {
  const hits = searchWords(el.search.value);
  const box = el.searchResults;
  box.textContent = "";
  box.classList.toggle("hidden", !el.search.value.trim());
  if (!el.search.value.trim()) return;
  if (!hits.length) {
    box.innerHTML = '<p class="search-none">ไม่พบคำนี้</p>';
    return;
  }
  hits.forEach((w) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "search-hit";
    b.innerHTML = `<span class="sw"></span><span class="sl"></span><span class="sm"></span>`;
    b.querySelector(".sw").textContent = `${w.word} (${w.pos})`;
    b.querySelector(".sl").textContent = w.level + " · " +
      { known: "จำได้แล้ว", learning: "ยังจำไม่ได้", new: "ยังไม่เปิด" }[statusOf(w)];
    b.querySelector(".sm").textContent = w.meaning;
    b.onclick = () => showSearchCard(w);
    box.appendChild(b);
  });
}

// เปิดการ์ดของคำที่ค้นหา (การ์ดเดียว) แล้วกลับไปโหมดเดิมได้
function showSearchCard(w) {
  if (mode !== "search") modeBeforeSearch = mode;
  mode = "search";
  deck = [w];
  index = 0;
  el.search.value = "";
  el.searchResults.classList.add("hidden");
  render();
  el.card.scrollIntoView({ behavior: "smooth", block: "center" });
}

// -------------------------------------------------------------
// 12) ลิสต์คำ: จำได้แล้ว / ยังจำไม่ได้ แยกตามระดับ
//     ลิสต์จำได้แล้ว ติ๊กลบได้ (คำที่ลบจะกลับเป็น "ยังไม่เปิด" เหมือนเล่นใหม่)
//     ลิสต์ยังจำไม่ได้ มีปุ่ม "ทวนลิสต์นี้"
// -------------------------------------------------------------
function listWords() {
  return byLevel(WORDS, listLevel).filter((w) => statusOf(w) === listTab);
}

let listSignature = "";
function renderList(c) {
  c = c || computeCounts();
  const words = listWords();
  // ลบคำที่ติ๊กไว้แต่ไม่อยู่ในลิสต์แล้วออก
  const keys = new Set(words.map(wordKey));
  listChecked = new Set([...listChecked].filter((k) => keys.has(k)));

  el.tabKnown.classList.toggle("active", listTab === "known");
  el.tabLearning.classList.toggle("active", listTab === "learning");
  el.tabKnown.textContent = `✅ จำได้แล้ว (${c.ALL.known})`;
  el.tabLearning.textContent = `❌ ยังจำไม่ได้ (${c.ALL.learning})`;

  // ปุ่มด้านบนลิสต์
  const act = el.listActions;
  act.textContent = "";
  const info = document.createElement("span");
  info.className = "list-count";
  info.textContent = `${words.length} คำ`;
  act.appendChild(info);
  if (words.length && listTab === "known") {
    const all = words.length > 0 && listChecked.size === words.length;
    act.appendChild(makeButton(all ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด", "btn small", () => {
      listChecked = all ? new Set() : new Set(keys);
      renderList();
    }));
    const del = makeButton(`ลบที่เลือก (${listChecked.size})`, "btn small red", () => resetWords([...listChecked]));
    del.disabled = listChecked.size === 0;
    act.appendChild(del);
    act.appendChild(makeButton("ลบทั้งหมด", "btn small", () => resetWords([...keys])));
  }
  if (words.length && listTab === "learning") {
    act.appendChild(makeButton("🔁 ทวนลิสต์นี้", "btn small primary", () => {
      setLevel(listLevel);
      setMode("review");
      el.card.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  // รายการคำ: สร้างใหม่เฉพาะตอนที่คำในลิสต์เปลี่ยน (ลิสต์ยาวได้หลายพันคำ)
  const box = el.wordList;
  const sig = listTab + "/" + listLevel + "/" + [...keys].join(",");
  if (sig === listSignature) {
    box.querySelectorAll("input[type=checkbox]").forEach((cb) => (cb.checked = listChecked.has(cb.dataset.key)));
    return;
  }
  listSignature = sig;
  box.textContent = "";
  if (!words.length) {
    box.innerHTML = '<p class="list-empty">ยังไม่มีคำในลิสต์นี้</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  words.forEach((w) => {
    const row = document.createElement(listTab === "known" ? "label" : "div");
    row.className = "list-row";
    row.innerHTML = `<span class="lw"></span><span class="lm"></span><span class="ll"></span>`;
    if (listTab === "known") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.key = wordKey(w);
      cb.checked = listChecked.has(wordKey(w));
      cb.onchange = () => {
        if (cb.checked) listChecked.add(wordKey(w)); else listChecked.delete(wordKey(w));
        renderList();
      };
      row.prepend(cb);
    }
    row.querySelector(".lw").textContent = w.word;
    row.querySelector(".lm").textContent = w.meaning;
    row.querySelector(".ll").textContent = w.level;
    frag.appendChild(row);
  });
  box.appendChild(frag);
}

// ลบคำออกจากลิสต์จำได้แล้ว: กลับเป็น "ยังไม่เปิด"
function resetWords(keys) {
  if (!keys.length) return;
  if (!confirm(`ลบ ${keys.length} คำออกจากลิสต์จำได้แล้วใช่ไหม? คำเหล่านี้จะกลับไปเป็นคำใหม่ในโหมดเรียนคำใหม่`)) return;
  const t = Date.now();
  keys.forEach((k) => (progress[k] = { s: "new", t }));
  saveLocal(STORAGE_PREFIX, progress);
  saveCloudWords(keys);
  listChecked = new Set();
  history = [];
  if (mode === "learn") buildDeck(); else render();
}
// -------------------------------------------------------------
// 13) ออกเสียงด้วย Web Speech API
//    หมายเหตุ: เสียงที่มีขึ้นกับเบราว์เซอร์และระบบปฏิบัติการ
//    บางเครื่องไม่มีเสียง en-GB หรือ en-US ให้เลือก เว็บจะแจ้งเตือน
// -------------------------------------------------------------
const speechSupported = "speechSynthesis" in window;
let voices = [];

function loadVoices() {
  if (!speechSupported) return;
  voices = speechSynthesis.getVoices();
  updateVoiceNotice();
}
if (speechSupported) {
  loadVoices();
  // รายชื่อเสียงมักโหลดเสร็จทีหลัง เบราว์เซอร์จะเรียก event นี้เมื่อพร้อม
  speechSynthesis.onvoiceschanged = loadVoices;
}

// หาเสียงที่ตรงกับสำเนียง เช่น "en-GB" (บางเบราว์เซอร์เขียนเป็น "en_GB")
function findVoice(lang) {
  const norm = (s) => s.replace("_", "-").toLowerCase();
  return voices.find((v) => norm(v.lang) === lang.toLowerCase()) || null;
}

function updateVoiceNotice() {
  let msg = "";
  if (!speechSupported) {
    msg = "เบราว์เซอร์นี้ไม่รองรับการออกเสียง ลองใช้ Chrome, Edge หรือ Safari";
  } else if (voices.length && !findVoice(el.accent.value)) {
    msg = `เครื่องนี้ไม่มีเสียงสำเนียง ${el.accent.value} จะใช้เสียงที่ใกล้เคียงแทน`;
  }
  el.voiceNotice.textContent = msg;
  el.voiceNotice.classList.toggle("hidden", !msg);
}

function speak(text) {
  if (!speechSupported || !text) return;
  speechSynthesis.cancel(); // หยุดเสียงเก่าก่อน ถ้ากดซ้ำเร็วๆ
  const u = new SpeechSynthesisUtterance(text);
  u.lang = el.accent.value;
  u.rate = Number(el.speed.value);
  const v = findVoice(el.accent.value);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}


// -------------------------------------------------------------
// 14) Firebase: เก็บข้อมูลใน Firestore ที่ users/{uid}
//     progress = สถานะของแต่ละคำ, goal = เป้าหมาย, streak = วันที่เล่นติดกัน
// -------------------------------------------------------------
function userDoc() {
  return db.collection("users").doc(currentUser.uid);
}

function syncText(promise) {
  el.sync.textContent = "กำลังบันทึกขึ้นคลาวด์...";
  promise
    .then(() => (el.sync.textContent = "บันทึกขึ้นคลาวด์แล้ว ✔"))
    .catch((err) => {
      console.error(err);
      el.sync.textContent = "บันทึกขึ้นคลาวด์ไม่สำเร็จ: " + err.code;
    });
}

// บันทึกเฉพาะคำที่เพิ่งเปลี่ยน ใช้ merge:true เพื่อไม่ลบคำอื่น
function saveCloudWords(keys) {
  if (!currentUser || !db) return;
  const part = {};
  keys.forEach((k) => (part[k] = progress[k]));
  syncText(userDoc().set({ progress: part }, { merge: true }));
}

// บันทึกทั้งฟิลด์ (goal หรือ streak) แทนที่ของเดิมทั้งก้อน
function saveCloudField(name, value) {
  if (!currentUser || !db) return;
  syncText(userDoc().set({ [name]: value }, { mergeFields: [name] }));
}

// ข้อมูลไหนแก้ทีหลังใช้อันนั้น (ดูจากเวลา t)
function newer(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return (b.t || 0) > (a.t || 0) ? b : a;
}

// ตอนล็อกอินหรือกลับมาเปิดหน้าเว็บ: รวมข้อมูลในเครื่องกับบนคลาวด์
// ถ้าคำเดียวกันมีทั้งสองที่ ใช้อันที่กดทีหลัง
async function syncFromCloud(rebuild) {
  if (!currentUser || !db) return;
  el.sync.textContent = "กำลังโหลดข้อมูลจากคลาวด์...";
  try {
    const snap = await userDoc().get();
    const data = (snap.exists && snap.data()) || {};
    const cloud = data.progress || {};
    const merged = { ...cloud };
    for (const [key, val] of Object.entries(progress)) {
      if (!merged[key] || (val.t || 0) > (merged[key].t || 0)) merged[key] = val;
    }
    progress = merged;
    goal = newer(goal, data.goal);
    streak = newer(streak, data.streak) || streak;
    saveLocal(STORAGE_PREFIX, progress);
    saveLocal(GOAL_PREFIX, goal);
    saveLocal(STREAK_PREFIX, streak);
    await userDoc().set({ progress: merged, goal, streak }, { mergeFields: ["progress", "goal", "streak"] });
    el.sync.textContent = "ซิงก์ข้อมูลกับคลาวด์แล้ว ✔";
    renderStreak();
    if (rebuild) buildDeck(); else render();
  } catch (err) {
    console.error(err);
    el.sync.textContent = "โหลดข้อมูลจากคลาวด์ไม่สำเร็จ: " + err.code;
  }
}
// แปลงรหัส error ของ Firebase เป็นข้อความภาษาไทย
function authErrorText(err) {
  const map = {
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/missing-password": "กรุณาใส่รหัสผ่าน",
    "auth/weak-password": "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร",
    "auth/email-already-in-use": "อีเมลนี้สมัครไว้แล้ว ลองกดล็อกอินแทน",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/user-not-found": "ไม่พบบัญชีนี้ ลองกดสมัครสมาชิก",
    "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
    "auth/popup-closed-by-user": "ปิดหน้าต่าง Google ก่อนล็อกอินเสร็จ",
    "auth/popup-blocked": "เบราว์เซอร์บล็อกป๊อปอัป กรุณาอนุญาตป๊อปอัปแล้วลองใหม่",
    "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้เพิ่มใน Authorized domains ของ Firebase (ดูขั้นที่ 4)",
    "auth/operation-not-allowed": "ยังไม่ได้เปิดวิธีล็อกอินนี้ใน Firebase Console (ดูขั้นที่ 2)",
    "auth/network-request-failed": "เชื่อมต่ออินเทอร์เน็ตไม่ได้",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "apiKey ใน app.js ไม่ถูกต้อง ให้คัดลอกจาก Firebase Console มาวางใหม่",
    "auth/invalid-api-key": "apiKey ใน app.js ไม่ถูกต้อง ให้คัดลอกจาก Firebase Console มาวางใหม่"
  };
  return map[err.code] || "เกิดข้อผิดพลาด: " + (err.code || err.message);
}

// แสดงข้อความใต้ฟอร์ม (สีแดง = ผิดพลาด, สีเขียว = สำเร็จ)
function showMessage(target, text, ok) {
  target.textContent = text;
  target.classList.toggle("ok", !!ok);
}

// สลับหน้าจอ: "loading" | "auth" | "app"
function showScreen(name) {
  el.loadingScreen.classList.toggle("hidden", name !== "loading");
  el.authScreen.classList.toggle("hidden", name !== "auth");
  el.appScreen.classList.toggle("hidden", name !== "app");
}

// สลับระหว่างหน้าเข้าสู่ระบบ กับหน้าสมัครสมาชิก
function showAuthView(name) {
  el.loginView.classList.toggle("hidden", name !== "login");
  el.registerView.classList.toggle("hidden", name !== "register");
  showMessage(el.loginMsg, "");
  showMessage(el.registerMsg, "");
}

// ปิดปุ่มในฟอร์มระหว่างรอ Firebase ตอบ กันกดซ้ำ และให้รู้ว่ากำลังทำงาน
function setBusy(form, busy) {
  form.querySelectorAll("button").forEach((b) => (b.disabled = busy));
  const submit = form.querySelector('button[type="submit"]');
  if (busy) {
    submit.dataset.label = submit.textContent;
    submit.textContent = "กำลังดำเนินการ...";
  } else if (submit.dataset.label) {
    submit.textContent = submit.dataset.label;
  }
}

function setupAuth() {
  if (!firebaseReady) {
    showScreen("auth");
    showMessage(el.loginMsg, "ยังไม่ได้ใส่ Firebase config ใน app.js หรือโหลด Firebase ไม่ได้ (เช็กอินเทอร์เน็ต)");
    el.loginView.querySelectorAll("button").forEach((b) => (b.disabled = true));
    return;
  }

  // ฟังก์ชันนี้ถูกเรียกทุกครั้งที่สถานะล็อกอินเปลี่ยน (รวมถึงตอนเปิดเว็บใหม่)
  // Firebase จำการล็อกอินไว้ให้ เปิดเว็บครั้งหน้าจะเข้าหน้าเล่นเลยโดยไม่ต้องล็อกอินใหม่
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      el.userLabel.textContent = user.email || user.displayName || "ผู้ใช้";
      // แสดงข้อมูลในเครื่องก่อน ระหว่างรอคลาวด์
      progress = loadLocal(STORAGE_PREFIX, {});
      goal = loadLocal(GOAL_PREFIX, null);
      streak = loadLocal(STREAK_PREFIX, { current: 0, longest: 0, last: "", t: 0 });
      renderStreak();
      setMode("learn");
      showScreen("app");
      syncFromCloud(true);
    } else {
      progress = {};
      goal = null;
      history = [];
      el.sync.textContent = "";
      el.loginPassword.value = "";
      el.registerPassword.value = "";
      el.registerConfirm.value = "";
      showAuthView("login");
      showScreen("auth");
    }
  });

  // ----- เข้าสู่ระบบด้วยอีเมล -----
  el.loginView.onsubmit = (e) => {
    e.preventDefault(); // ไม่ให้ฟอร์มรีโหลดหน้าเว็บ
    const email = el.loginEmail.value.trim();
    const password = el.loginPassword.value;
    if (!email || !password) return showMessage(el.loginMsg, "กรุณาใส่อีเมลและรหัสผ่าน");
    setBusy(el.loginView, true);
    auth.signInWithEmailAndPassword(email, password)
      .catch((err) => showMessage(el.loginMsg, authErrorText(err)))
      .finally(() => setBusy(el.loginView, false));
  };

  // ----- สมัครสมาชิกด้วยอีเมล -----
  el.registerView.onsubmit = (e) => {
    e.preventDefault();
    const email = el.registerEmail.value.trim();
    const password = el.registerPassword.value;
    if (!email || !password) return showMessage(el.registerMsg, "กรุณาใส่อีเมลและตั้งรหัสผ่าน");
    if (password.length < 6) return showMessage(el.registerMsg, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
    if (password !== el.registerConfirm.value) return showMessage(el.registerMsg, "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(el.registerView, true);
    // สมัครสำเร็จ Firebase จะล็อกอินให้อัตโนมัติ แล้ว onAuthStateChanged จะพาไปหน้าเล่น
    auth.createUserWithEmailAndPassword(email, password)
      .catch((err) => showMessage(el.registerMsg, authErrorText(err)))
      .finally(() => setBusy(el.registerView, false));
  };

  // ----- ลืมรหัสผ่าน -----
  $("resetBtn").onclick = () => {
    const email = el.loginEmail.value.trim();
    if (!email) return showMessage(el.loginMsg, "ใส่อีเมลในช่องด้านบนก่อน แล้วกดลืมรหัสผ่านอีกครั้ง");
    auth.sendPasswordResetEmail(email)
      .then(() => showMessage(el.loginMsg, "ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว (ดูในกล่องจดหมายขยะด้วย)", true))
      .catch((err) => showMessage(el.loginMsg, authErrorText(err)));
  };

  // ----- Google (ใช้ได้ทั้งหน้าเข้าสู่ระบบและหน้าสมัคร: ครั้งแรกที่ใช้คือการสมัครไปในตัว) -----
  document.querySelectorAll(".google-btn").forEach((btn) => {
    btn.onclick = () => {
      const form = btn.closest("form");
      const msg = form === el.loginView ? el.loginMsg : el.registerMsg;
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch((err) => showMessage(msg, authErrorText(err)));
    };
  });

  // ----- ลิงก์สลับหน้า -----
  $("toRegister").onclick = () => showAuthView("register");
  $("toLogin").onclick = () => showAuthView("login");

  // ----- ออกจากระบบ: กลับไปหน้าเข้าสู่ระบบ (ข้อมูลยังอยู่บนคลาวด์ครบ) -----
  el.logoutBtn.onclick = () => auth.signOut();
}
// -------------------------------------------------------------
// 15) บันทึกการตั้งค่า (สำเนียง ความเร็ว) ไว้ในเครื่อง
// -------------------------------------------------------------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    if (s.accent) el.accent.value = s.accent;
    if (s.speed) el.speed.value = s.speed;
  } catch (e) { /* ไม่เป็นไร ใช้ค่าเริ่มต้น */ }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ accent: el.accent.value, speed: el.speed.value }));
  } catch (e) { /* ไม่เป็นไร */ }
}

// -------------------------------------------------------------
// 15.1) โหมดสว่าง/มืด
//    ครั้งแรกใช้ตามการตั้งค่าของเครื่อง ถ้ากดปุ่มเลือกเอง จะจำไว้ใน localStorage
//    (สีของแต่ละโหมดกำหนดไว้ใน style.css)
// -------------------------------------------------------------
const THEME_KEY = "flashcard-theme";

function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function updateThemeButtons() {
  const dark = currentTheme() === "dark";
  document.querySelectorAll(".theme-btn").forEach((b) => {
    b.textContent = dark ? "☀️" : "🌙"; // แสดงไอคอนของโหมดที่จะสลับไป
    b.title = dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด";
  });
}
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ไม่เป็นไร */ }
  updateThemeButtons();
}
document.querySelectorAll(".theme-btn").forEach((b) => (b.onclick = toggleTheme));
updateThemeButtons();


// -------------------------------------------------------------
// 16) ผูกปุ่มต่างๆ กับฟังก์ชัน
// -------------------------------------------------------------
el.card.onclick = () => el.card.classList.toggle("flipped");

// ปุ่มลำโพงอยู่บนการ์ด ต้องหยุด event ไม่ให้การ์ดพลิกตอนกด
$("speakWordBtn").onclick = (e) => { e.stopPropagation(); speak(deck[index]?.word); };
$("speakExampleBtn").onclick = (e) => { e.stopPropagation(); speak(deck[index]?.example); };

$("knownBtn").onclick = () => mark("known");
$("unknownBtn").onclick = () => mark("learning");
$("nextBtn").onclick = next;
$("prevBtn").onclick = prev;
el.undo.onclick = undo;

el.reviewPill.onclick = () => setMode("review");
$("backToLearn").onclick = () => setMode("learn");

document.querySelectorAll("#levelButtons .level-btn").forEach((btn) => {
  btn.onclick = () => setLevel(btn.dataset.level);
});

// ลิสต์คำ
el.tabKnown.onclick = () => { listTab = "known"; listChecked = new Set(); renderList(); };
el.tabLearning.onclick = () => { listTab = "learning"; listChecked = new Set(); renderList(); };
document.querySelectorAll("#listLevels .level-btn").forEach((btn) => {
  btn.onclick = () => {
    listLevel = btn.dataset.level;
    listChecked = new Set();
    document.querySelectorAll("#listLevels .level-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderList();
  };
});

// ค้นหา
el.search.oninput = renderSearch;
el.search.onkeydown = (e) => {
  if (e.key === "Enter") {
    const first = searchWords(el.search.value)[0];
    if (first) showSearchCard(first);
  }
  if (e.key === "Escape") { el.search.value = ""; renderSearch(); }
};
// คลิกที่อื่นแล้วปิดผลค้นหา
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) el.searchResults.classList.add("hidden");
});

el.accent.onchange = () => { saveSettings(); updateVoiceNotice(); };
el.speed.onchange = saveSettings;

// คีย์ลัดบนคอมพิวเตอร์: Space = พลิก, ← → = เลื่อนการ์ด
document.addEventListener("keydown", (e) => {
  if (el.appScreen.classList.contains("hidden")) return; // ยังไม่อยู่หน้าเล่น
  if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
  if (!el.goalModal.classList.contains("hidden") || !el.doneModal.classList.contains("hidden")) return;
  if (e.key === " ") { e.preventDefault(); el.card.classList.toggle("flipped"); }
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
});

// กลับมาเปิดแท็บนี้อีกครั้ง: ดึงข้อมูลล่าสุดจากคลาวด์ (เผื่อเล่นจากอีกเครื่องไว้)
// และอัปเดตเวลาที่เหลือของเป้าหมาย
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser) syncFromCloud(false);
});
setInterval(() => { if (currentUser && activeGoal()) renderGoal(); }, 60000);

// -------------------------------------------------------------
// 17) เริ่มทำงาน
// -------------------------------------------------------------
loadSettings();
updateVoiceNotice();
setupAuth(); // จะเลือกเองว่าแสดงหน้าเข้าสู่ระบบหรือหน้าเล่น
