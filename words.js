// =============================================================
// words.js : ข้อมูลคำศัพท์
// รูปแบบของแต่ละคำ: { word, pos, level, meaning, example, exampleTh }
//   word    = คำศัพท์ภาษาอังกฤษ
//   pos     = ชนิดของคำ (noun, verb, adjective, adverb ...)
//   level   = ระดับ CEFR: "A1", "A2", "B1" หรือ "B2"
//   meaning = ความหมายภาษาไทย (เขียนเอง)
//   example = ประโยคตัวอย่าง (แต่งเอง ไม่ได้คัดลอกจากหนังสือหรือ PDF)
//   exampleTh = คำแปลประโยคตัวอย่างเป็นภาษาไทย (ไม่ใส่ก็ได้ การ์ดจะไม่แสดงบรรทัดนี้)
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
  { word: "friend", pos: "noun", level: "A1", meaning: "เพื่อน", example: "My best friend lives next to my house.", exampleTh: "เพื่อนสนิทของฉันอาศัยอยู่ข้างบ้านฉัน" },
  { word: "family", pos: "noun", level: "A1", meaning: "ครอบครัว", example: "There are five people in my family.", exampleTh: "ครอบครัวของฉันมีห้าคน" },
  { word: "opinion", pos: "noun", level: "A1", meaning: "ความคิดเห็น", example: "In my opinion, this film is too long.", exampleTh: "ในความคิดของฉัน หนังเรื่องนี้ยาวเกินไป" },
  { word: "eat", pos: "verb", level: "A1", meaning: "กิน", example: "We usually eat rice for dinner.", exampleTh: "เรามักกินข้าวเป็นมื้อเย็น" },
  { word: "read", pos: "verb", level: "A1", meaning: "อ่าน", example: "Can you read this word for me?", exampleTh: "ช่วยอ่านคำนี้ให้ฉันฟังได้ไหม" },
  { word: "explain", pos: "verb", level: "A1", meaning: "อธิบาย", example: "The teacher explained the lesson again.", exampleTh: "ครูอธิบายบทเรียนอีกครั้ง" },
  { word: "decide", pos: "verb", level: "A1", meaning: "ตัดสินใจ", example: "I decided to study English every day.", exampleTh: "ฉันตัดสินใจเรียนภาษาอังกฤษทุกวัน" },
  { word: "happy", pos: "adjective", level: "A1", meaning: "มีความสุข, ดีใจ", example: "She was very happy with her exam results.", exampleTh: "เธอดีใจมากกับผลสอบของเธอ" },
  { word: "beautiful", pos: "adjective", level: "A1", meaning: "สวยงาม", example: "The beach was beautiful in the morning.", exampleTh: "ชายหาดสวยงามในตอนเช้า" },
  { word: "dangerous", pos: "adjective", level: "A1", meaning: "อันตราย", example: "It is dangerous to swim here.", exampleTh: "การว่ายน้ำตรงนี้อันตราย" },

  // ---------- A2 ----------
  { word: "accident", pos: "noun", level: "A2", meaning: "อุบัติเหตุ", example: "He broke his leg in a car accident.", exampleTh: "เขาขาหักจากอุบัติเหตุรถยนต์" },
  { word: "environment", pos: "noun", level: "A2", meaning: "สิ่งแวดล้อม", example: "We should protect the environment.", exampleTh: "เราควรปกป้องสิ่งแวดล้อม" },
  { word: "pollution", pos: "noun", level: "A2", meaning: "มลพิษ", example: "Air pollution is a big problem in the city.", exampleTh: "มลพิษทางอากาศเป็นปัญหาใหญ่ในเมือง" },
  { word: "evidence", pos: "noun", level: "A2", meaning: "หลักฐาน", example: "The police found new evidence.", exampleTh: "ตำรวจพบหลักฐานใหม่" },
  { word: "borrow", pos: "verb", level: "A2", meaning: "ยืม (ของคนอื่นมาใช้)", example: "Can I borrow your pen for a minute?", exampleTh: "ขอยืมปากกาของคุณสักครู่ได้ไหม" },
  { word: "invite", pos: "verb", level: "A2", meaning: "เชิญ", example: "They invited me to their wedding.", exampleTh: "พวกเขาเชิญฉันไปงานแต่งงานของพวกเขา" },
  { word: "recommend", pos: "verb", level: "A2", meaning: "แนะนำ", example: "Can you recommend a good restaurant?", exampleTh: "คุณช่วยแนะนำร้านอาหารดีๆ ได้ไหม" },
  { word: "achieve", pos: "verb", level: "A2", meaning: "ทำสำเร็จ, บรรลุ", example: "He worked hard to achieve his goal.", exampleTh: "เขาทำงานหนักเพื่อให้บรรลุเป้าหมาย" },
  { word: "careful", pos: "adjective", level: "A2", meaning: "ระมัดระวัง", example: "Be careful when you cross the road.", exampleTh: "ระวังตอนข้ามถนนนะ" },
  { word: "ancient", pos: "adjective", level: "A2", meaning: "โบราณ", example: "Ayutthaya is an ancient city.", exampleTh: "อยุธยาเป็นเมืองโบราณ" },

  // ---------- B1 ----------
  { word: "journey", pos: "noun", level: "B1", meaning: "การเดินทาง", example: "The journey to Chiang Mai took ten hours.", exampleTh: "การเดินทางไปเชียงใหม่ใช้เวลาสิบชั่วโมง" },
  { word: "consequence", pos: "noun", level: "B1", meaning: "ผลที่ตามมา", example: "Every decision has consequences.", exampleTh: "ทุกการตัดสินใจมีผลที่ตามมา" },
  { word: "attitude", pos: "noun", level: "B1", meaning: "ทัศนคติ", example: "She has a positive attitude to work.", exampleTh: "เธอมีทัศนคติที่ดีต่อการทำงาน" },
  { word: "appreciate", pos: "verb", level: "B1", meaning: "ซาบซึ้ง, เห็นคุณค่า", example: "I really appreciate your help.", exampleTh: "ฉันซาบซึ้งในความช่วยเหลือของคุณจริงๆ" },
  { word: "persuade", pos: "verb", level: "B1", meaning: "โน้มน้าว, ชักชวน", example: "I persuaded my brother to come with us.", exampleTh: "ฉันชักชวนน้องชายให้มากับเรา" },
  { word: "afford", pos: "verb", level: "B1", meaning: "มีเงินพอจะซื้อ/จ่าย", example: "We can't afford a new car this year.", exampleTh: "ปีนี้เราไม่มีเงินพอจะซื้อรถคันใหม่" },
  { word: "confident", pos: "adjective", level: "B1", meaning: "มั่นใจ", example: "I feel more confident when I speak English now.", exampleTh: "ตอนนี้ฉันรู้สึกมั่นใจขึ้นเวลาพูดภาษาอังกฤษ" },
  { word: "suitable", pos: "adjective", level: "B1", meaning: "เหมาะสม", example: "This film is not suitable for children.", exampleTh: "หนังเรื่องนี้ไม่เหมาะสำหรับเด็ก" },
  { word: "obvious", pos: "adjective", level: "B1", meaning: "ชัดเจน, เห็นได้ชัด", example: "The answer seems obvious now.", exampleTh: "ตอนนี้คำตอบดูชัดเจนแล้ว" },
  { word: "generous", pos: "adjective", level: "B1", meaning: "ใจกว้าง, มีน้ำใจ", example: "My aunt is very generous with her time.", exampleTh: "ป้าของฉันใจกว้างเรื่องการสละเวลาให้คนอื่น" },

  // ---------- B2 ----------
  { word: "priority", pos: "noun", level: "B2", meaning: "สิ่งที่สำคัญเป็นอันดับแรก", example: "My family is my top priority.", exampleTh: "ครอบครัวคือสิ่งสำคัญอันดับแรกของฉัน" },
  { word: "debate", pos: "noun", level: "B2", meaning: "การโต้วาที, การถกเถียง", example: "There was a long debate about the new rule.", exampleTh: "มีการถกเถียงกันนานเรื่องกฎใหม่" },
  { word: "abandon", pos: "verb", level: "B2", meaning: "ทิ้ง, ละทิ้ง", example: "They had to abandon the car in the flood.", exampleTh: "พวกเขาต้องทิ้งรถไว้กลางน้ำท่วม" },
  { word: "assess", pos: "verb", level: "B2", meaning: "ประเมิน", example: "Teachers assess students in many ways.", exampleTh: "ครูประเมินนักเรียนได้หลายวิธี" },
  { word: "interpret", pos: "verb", level: "B2", meaning: "ตีความ", example: "How do you interpret this poem?", exampleTh: "คุณตีความบทกวีนี้ว่าอย่างไร" },
  { word: "justify", pos: "verb", level: "B2", meaning: "ให้เหตุผลสนับสนุน", example: "Can you justify such a high price?", exampleTh: "คุณให้เหตุผลกับราคาที่สูงขนาดนี้ได้ไหม" },
  { word: "efficient", pos: "adjective", level: "B2", meaning: "มีประสิทธิภาพ", example: "This new machine is more efficient.", exampleTh: "เครื่องจักรใหม่นี้มีประสิทธิภาพมากกว่า" },
  { word: "anxious", pos: "adjective", level: "B2", meaning: "กังวล", example: "She felt anxious before the interview.", exampleTh: "เธอรู้สึกกังวลก่อนสัมภาษณ์งาน" },
  { word: "accurate", pos: "adjective", level: "B2", meaning: "แม่นยำ, ถูกต้อง", example: "Is this map accurate?", exampleTh: "แผนที่นี้ถูกต้องไหม" },
  { word: "capable", pos: "adjective", level: "B2", meaning: "มีความสามารถ", example: "She is capable of running the whole team.", exampleTh: "เธอมีความสามารถพอที่จะดูแลทั้งทีม" }
];
