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
const SETTINGS_KEY = "flashcard-settings";

// progress เก็บสถานะของแต่ละคำ เช่น
// { "book|noun": { s: "known", t: 1700000000000 } }
//   s = "known" (จำได้แล้ว) หรือ "learning" (ยังไม่จำ)
//   t = เวลาที่กดล่าสุด ใช้ตัดสินว่าข้อมูลไหนใหม่กว่าตอนรวมข้อมูลจากหลายเครื่อง
let progress = {};
let currentUser = null;

let selectedLevel = "ALL";
let onlyUnknown = false;
let deck = [];        // รายการคำที่กำลังแสดงอยู่ (หลังกรองแล้ว)
let index = 0;        // ตำแหน่งการ์ดปัจจุบันใน deck
let shuffled = false;

// ใช้ word + pos เป็นรหัสของคำ เพราะบางคำมีหลายชนิด (เช่น "book" noun / verb)
function wordKey(w) {
  return w.word + "|" + w.pos;
}

// -------------------------------------------------------------
// 3) ดึง element จากหน้าเว็บ
// -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  card: $("card"), counter: $("counter"), empty: $("emptyMessage"),
  word: $("wordText"), pos: $("posText"), levelTag: $("levelTag"), statusTag: $("statusTag"),
  meaning: $("meaningText"), example: $("exampleText"), exampleTh: $("exampleThText"),
  onlyUnknown: $("onlyUnknown"), accent: $("accentSelect"), speed: $("speedSelect"),
  voiceNotice: $("voiceNotice"), stats: $("statsList"), sync: $("syncStatus"),
  userLabel: $("userLabel"), logoutBtn: $("logoutBtn"),
  // 3 หน้าจอหลัก: กำลังโหลด / เข้าสู่ระบบ-สมัคร / เล่นแฟลชการ์ด
  loadingScreen: $("loadingScreen"), authScreen: $("authScreen"), appScreen: $("appScreen"),
  loginView: $("loginView"), registerView: $("registerView"),
  loginEmail: $("loginEmail"), loginPassword: $("loginPassword"), loginMsg: $("loginMessage"),
  registerEmail: $("registerEmail"), registerPassword: $("registerPassword"),
  registerConfirm: $("registerConfirm"), registerMsg: $("registerMessage")
};

// -------------------------------------------------------------
// 4) localStorage: สำเนาความคืบหน้าในเครื่อง
//    ช่วยให้เปิดเว็บแล้วเห็นข้อมูลทันที และไม่หายถ้าเน็ตหลุดระหว่างกด
// -------------------------------------------------------------
function localKey() {
  return STORAGE_PREFIX + (currentUser ? currentUser.uid : "none");
}
function loadLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem(localKey())) || {};
  } catch (e) {
    return {}; // ถ้าข้อมูลเสียหรือเบราว์เซอร์ปิด localStorage ก็เริ่มใหม่
  }
}
function saveLocalProgress() {
  try {
    localStorage.setItem(localKey(), JSON.stringify(progress));
  } catch (e) { /* โหมดไม่ระบุตัวตนบางเบราว์เซอร์อาจบันทึกไม่ได้ */ }
}

// -------------------------------------------------------------
// 5) จัดชุดการ์ดตามตัวกรอง และสุ่มลำดับ
// -------------------------------------------------------------
function buildDeck(keepCurrent) {
  const currentKey = deck[index] ? wordKey(deck[index]) : null;

  deck = WORDS.filter((w) => {
    if (selectedLevel !== "ALL" && w.level !== selectedLevel) return false;
    if (onlyUnknown && progress[wordKey(w)]?.s === "known") return false;
    return true;
  });
  if (shuffled) shuffleArray(deck);

  // พยายามอยู่ที่การ์ดเดิม ถ้าการ์ดเดิมยังอยู่ในชุด
  const found = keepCurrent ? deck.findIndex((w) => wordKey(w) === currentKey) : -1;
  index = found >= 0 ? found : Math.min(index, Math.max(deck.length - 1, 0));
  if (!keepCurrent) index = 0;
  render();
}

// สุ่มลำดับแบบ Fisher–Yates: สลับตำแหน่งจากท้ายมาหน้า ทำให้ทุกลำดับมีโอกาสเท่ากัน
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// -------------------------------------------------------------
// 6) แสดงผลการ์ดและสถิติ
// -------------------------------------------------------------
function render() {
  el.card.classList.remove("flipped");
  const hasCards = deck.length > 0;
  el.card.classList.toggle("hidden", !hasCards);
  el.empty.classList.toggle("hidden", hasCards);
  ["knownBtn", "unknownBtn", "prevBtn", "nextBtn"].forEach((id) => ($(id).disabled = !hasCards));

  if (hasCards) {
    const w = deck[index];
    // ใช้ textContent (ไม่ใช้ innerHTML) เพื่อกันโค้ดแปลกๆ ในข้อมูลคำศัพท์
    el.word.textContent = w.word;
    el.pos.textContent = w.pos;
    el.levelTag.textContent = w.level;
    el.meaning.textContent = w.meaning;
    el.example.textContent = w.example;
    el.exampleTh.textContent = w.exampleTh || ""; // คำไหนยังไม่มีคำแปล บรรทัดนี้จะว่าง

    const st = progress[wordKey(w)]?.s;
    el.statusTag.className = "status-tag" + (st ? " " + st : "");
    el.statusTag.textContent = st === "known" ? "จำได้แล้ว" : st === "learning" ? "ยังไม่จำ" : "";
    el.counter.textContent = `การ์ด ${index + 1} / ${deck.length}` + (shuffled ? " (สุ่ม)" : "");
  } else {
    el.counter.textContent = "";
  }
  renderStats();
}

function renderStats() {
  el.stats.textContent = "";
  const rows = [...LEVELS, "ALL"].map((lv) => {
    const words = lv === "ALL" ? WORDS : WORDS.filter((w) => w.level === lv);
    const known = words.filter((w) => progress[wordKey(w)]?.s === "known").length;
    return { label: lv === "ALL" ? "รวมทั้งหมด" : lv, known, total: words.length };
  });
  rows.forEach((r) => {
    const pct = r.total ? Math.round((r.known / r.total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `<div class="stat-label"><span></span><span></span></div>
                     <div class="bar"><div class="bar-fill"></div></div>`;
    row.querySelector(".stat-label span:first-child").textContent = r.label;
    row.querySelector(".stat-label span:last-child").textContent =
      `จำได้ ${r.known} / ${r.total} คำ (${pct}%)`;
    row.querySelector(".bar-fill").style.width = pct + "%";
    el.stats.appendChild(row);
  });
}

// -------------------------------------------------------------
// 7) ทำเครื่องหมาย จำได้แล้ว / ยังไม่จำ
// -------------------------------------------------------------
function mark(status) {
  if (!deck.length) return;
  const key = wordKey(deck[index]);
  progress[key] = { s: status, t: Date.now() };
  saveLocalProgress();
  saveCloudWord(key);

  // ถ้าเปิดตัวกรอง "เฉพาะคำที่ยังไม่จำ" แล้วกดจำได้ การ์ดนี้จะหายจากชุด
  if (onlyUnknown && status === "known") {
    deck.splice(index, 1);
    if (index >= deck.length) index = 0;
    render();
  } else {
    next();
  }
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
// 8) ออกเสียงด้วย Web Speech API
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
// 9) Firebase: ล็อกอิน และเก็บความคืบหน้าใน Firestore
//    ข้อมูลอยู่ที่ users/{uid} มีฟิลด์ progress (แบบเดียวกับใน localStorage)
// -------------------------------------------------------------
function userDoc() {
  return db.collection("users").doc(currentUser.uid);
}

// บันทึกเฉพาะคำที่เพิ่งกด ใช้ merge:true เพื่อไม่ลบคำอื่น
function saveCloudWord(key) {
  if (!currentUser) return;
  el.sync.textContent = "กำลังบันทึกขึ้นคลาวด์...";
  userDoc()
    .set({ progress: { [key]: progress[key] } }, { merge: true })
    .then(() => (el.sync.textContent = "บันทึกขึ้นคลาวด์แล้ว ✔"))
    .catch((err) => {
      console.error(err);
      el.sync.textContent = "บันทึกขึ้นคลาวด์ไม่สำเร็จ: " + err.code;
    });
}

// ตอนล็อกอิน: รวมข้อมูลในเครื่องกับบนคลาวด์ ถ้าคำเดียวกันมีทั้งสองที่ ใช้อันที่กดทีหลัง
async function syncAfterLogin() {
  el.sync.textContent = "กำลังโหลดข้อมูลจากคลาวด์...";
  try {
    const snap = await userDoc().get();
    const cloud = (snap.exists && snap.data().progress) || {};
    const merged = { ...cloud };
    for (const [key, val] of Object.entries(progress)) {
      if (!merged[key] || (val.t || 0) > (merged[key].t || 0)) merged[key] = val;
    }
    progress = merged;
    saveLocalProgress();
    await userDoc().set({ progress: merged }, { merge: true });
    el.sync.textContent = "ซิงก์ข้อมูลกับคลาวด์แล้ว ✔";
    buildDeck(true);
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
      progress = loadLocalProgress(); // แสดงข้อมูลในเครื่องก่อน ระหว่างรอคลาวด์
      buildDeck(false);
      showScreen("app");
      syncAfterLogin();
    } else {
      progress = {};
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
// 10) บันทึกการตั้งค่า (สำเนียง ความเร็ว) ไว้ในเครื่อง
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
// 10.1) โหมดสว่าง/มืด
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
// 11) ผูกปุ่มต่างๆ กับฟังก์ชัน
// -------------------------------------------------------------
el.card.onclick = () => el.card.classList.toggle("flipped");

// ปุ่มลำโพงอยู่บนการ์ด ต้องหยุด event ไม่ให้การ์ดพลิกตอนกด
$("speakWordBtn").onclick = (e) => { e.stopPropagation(); speak(deck[index]?.word); };
$("speakExampleBtn").onclick = (e) => { e.stopPropagation(); speak(deck[index]?.example); };

$("knownBtn").onclick = () => mark("known");
$("unknownBtn").onclick = () => mark("learning");
$("nextBtn").onclick = next;
$("prevBtn").onclick = prev;

$("shuffleBtn").onclick = () => {
  shuffled = true;
  buildDeck(false);
};

document.querySelectorAll(".level-btn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".level-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedLevel = btn.dataset.level;
    buildDeck(false);
  };
});

el.onlyUnknown.onchange = () => {
  onlyUnknown = el.onlyUnknown.checked;
  buildDeck(false);
};
el.accent.onchange = () => { saveSettings(); updateVoiceNotice(); };
el.speed.onchange = saveSettings;

// คีย์ลัดบนคอมพิวเตอร์: Space = พลิก, ← → = เลื่อนการ์ด
document.addEventListener("keydown", (e) => {
  if (el.appScreen.classList.contains("hidden")) return; // ยังไม่อยู่หน้าเล่น
  if (["INPUT", "SELECT", "BUTTON"].includes(e.target.tagName)) return;
  if (e.key === " ") { e.preventDefault(); el.card.classList.toggle("flipped"); }
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
});

// -------------------------------------------------------------
// 12) เริ่มทำงาน
// -------------------------------------------------------------
loadSettings();
updateVoiceNotice();
setupAuth(); // จะเลือกเองว่าแสดงหน้าเข้าสู่ระบบหรือหน้าเล่น
