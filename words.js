// =============================================================
// words.js : ข้อมูลคำศัพท์
// รูปแบบของแต่ละคำ: { word, pos, level, meaning, example }
//   word    = คำศัพท์ภาษาอังกฤษ
//   pos     = ชนิดของคำ (noun, verb, adjective, adverb ...)
//   level   = ระดับ CEFR: "A1", "A2", "B1" หรือ "B2"
//   meaning = ความหมายภาษาไทย (เขียนเอง)
//   example = ประโยคตัวอย่าง (แต่งเอง ไม่ได้คัดลอกจากหนังสือหรือ PDF)
//
// วิธีเพิ่มคำ: คัดลอกบรรทัดหนึ่งไปวางต่อท้าย แล้วแก้ข้อความ
// อย่าลืมเครื่องหมายจุลภาค (,) คั่นระหว่างแต่ละคำ
//
// เรื่องระดับ CEFR: ระดับของทั้ง 40 คำด้านล่างเทียบกับไฟล์ Oxford 3000
// ฉบับ English TestLab ที่ส่งมาแล้ว ตรงกันทุกคำ แต่ไฟล์นั้นไม่ใช่ไฟล์ทางการ
// ของ Oxford ถ้าจะให้ชัวร์ 100% ให้เทียบกับ PDF จากเว็บ Oxford อีกครั้ง
// (ใช้ตัวสะกดแบบอเมริกันตามไฟล์นั้น)
// =============================================================

const WORDS = [
  // ---------- A1 ----------
  { word: "friend", pos: "noun", level: "A1", meaning: "เพื่อน", example: "My best friend lives next to my house." },
  { word: "family", pos: "noun", level: "A1", meaning: "ครอบครัว", example: "There are five people in my family." },
  { word: "opinion", pos: "noun", level: "A1", meaning: "ความคิดเห็น", example: "In my opinion, this film is too long." },
  { word: "eat", pos: "verb", level: "A1", meaning: "กิน", example: "We usually eat rice for dinner." },
  { word: "read", pos: "verb", level: "A1", meaning: "อ่าน", example: "Can you read this word for me?" },
  { word: "explain", pos: "verb", level: "A1", meaning: "อธิบาย", example: "The teacher explained the lesson again." },
  { word: "decide", pos: "verb", level: "A1", meaning: "ตัดสินใจ", example: "I decided to study English every day." },
  { word: "happy", pos: "adjective", level: "A1", meaning: "มีความสุข, ดีใจ", example: "She was very happy with her exam results." },
  { word: "beautiful", pos: "adjective", level: "A1", meaning: "สวยงาม", example: "The beach was beautiful in the morning." },
  { word: "dangerous", pos: "adjective", level: "A1", meaning: "อันตราย", example: "It is dangerous to swim here." },

  // ---------- A2 ----------
  { word: "accident", pos: "noun", level: "A2", meaning: "อุบัติเหตุ", example: "He broke his leg in a car accident." },
  { word: "environment", pos: "noun", level: "A2", meaning: "สิ่งแวดล้อม", example: "We should protect the environment." },
  { word: "pollution", pos: "noun", level: "A2", meaning: "มลพิษ", example: "Air pollution is a big problem in the city." },
  { word: "evidence", pos: "noun", level: "A2", meaning: "หลักฐาน", example: "The police found new evidence." },
  { word: "borrow", pos: "verb", level: "A2", meaning: "ยืม (ของคนอื่นมาใช้)", example: "Can I borrow your pen for a minute?" },
  { word: "invite", pos: "verb", level: "A2", meaning: "เชิญ", example: "They invited me to their wedding." },
  { word: "recommend", pos: "verb", level: "A2", meaning: "แนะนำ", example: "Can you recommend a good restaurant?" },
  { word: "achieve", pos: "verb", level: "A2", meaning: "ทำสำเร็จ, บรรลุ", example: "He worked hard to achieve his goal." },
  { word: "careful", pos: "adjective", level: "A2", meaning: "ระมัดระวัง", example: "Be careful when you cross the road." },
  { word: "ancient", pos: "adjective", level: "A2", meaning: "โบราณ", example: "Ayutthaya is an ancient city." },

  // ---------- B1 ----------
  { word: "journey", pos: "noun", level: "B1", meaning: "การเดินทาง", example: "The journey to Chiang Mai took ten hours." },
  { word: "consequence", pos: "noun", level: "B1", meaning: "ผลที่ตามมา", example: "Every decision has consequences." },
  { word: "attitude", pos: "noun", level: "B1", meaning: "ทัศนคติ", example: "She has a positive attitude to work." },
  { word: "appreciate", pos: "verb", level: "B1", meaning: "ซาบซึ้ง, เห็นคุณค่า", example: "I really appreciate your help." },
  { word: "persuade", pos: "verb", level: "B1", meaning: "โน้มน้าว, ชักชวน", example: "I persuaded my brother to come with us." },
  { word: "afford", pos: "verb", level: "B1", meaning: "มีเงินพอจะซื้อ/จ่าย", example: "We can't afford a new car this year." },
  { word: "confident", pos: "adjective", level: "B1", meaning: "มั่นใจ", example: "I feel more confident when I speak English now." },
  { word: "suitable", pos: "adjective", level: "B1", meaning: "เหมาะสม", example: "This film is not suitable for children." },
  { word: "obvious", pos: "adjective", level: "B1", meaning: "ชัดเจน, เห็นได้ชัด", example: "The answer seems obvious now." },
  { word: "generous", pos: "adjective", level: "B1", meaning: "ใจกว้าง, มีน้ำใจ", example: "My aunt is very generous with her time." },

  // ---------- B2 ----------
  { word: "priority", pos: "noun", level: "B2", meaning: "สิ่งที่สำคัญเป็นอันดับแรก", example: "My family is my top priority." },
  { word: "debate", pos: "noun", level: "B2", meaning: "การโต้วาที, การถกเถียง", example: "There was a long debate about the new rule." },
  { word: "abandon", pos: "verb", level: "B2", meaning: "ทิ้ง, ละทิ้ง", example: "They had to abandon the car in the flood." },
  { word: "assess", pos: "verb", level: "B2", meaning: "ประเมิน", example: "Teachers assess students in many ways." },
  { word: "interpret", pos: "verb", level: "B2", meaning: "ตีความ", example: "How do you interpret this poem?" },
  { word: "justify", pos: "verb", level: "B2", meaning: "ให้เหตุผลสนับสนุน", example: "Can you justify such a high price?" },
  { word: "efficient", pos: "adjective", level: "B2", meaning: "มีประสิทธิภาพ", example: "This new machine is more efficient." },
  { word: "anxious", pos: "adjective", level: "B2", meaning: "กังวล", example: "She felt anxious before the interview." },
  { word: "accurate", pos: "adjective", level: "B2", meaning: "แม่นยำ, ถูกต้อง", example: "Is this map accurate?" },
  { word: "capable", pos: "adjective", level: "B2", meaning: "มีความสามารถ", example: "She is capable of running the whole team." }
];
