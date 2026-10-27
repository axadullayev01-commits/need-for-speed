# 🏎️ NEED FOR SPEED // OVERDRIVE
### Real-Time Multiplayer 3D Car Racing Game (Authoritative Server Architecture)

> **Loyiha haqida qisqacha (O'zbekcha):**
> Ushbu loyiha brauzerda real vaqt rejimida (real-time) ishlovchi, ko'p o'yinchili (multiplayer) 3D poyga o'yini hisoblanadi. Loyiha **Authoritative Server Architecture** (server to'liq nazorati ostida) asosida qurilgan bo'lib, o'yinchilarning harakatlari, to'qnashuvlar (collisions), drift fizikasi va marra chiziqlari server tomonidan 60 FPS chastotada tekshiriladi va xakerlik/aldovlarning (anti-cheat) oldi olinadi.

---

## 🌐 Jonli Server (Live Online)

O'yin internetga to'liq joylangan (deploy qilingan) va istalgan brauzerdan ulanish mumkin:
* **Jonli O'yin Havolasi (URL):** **[https://need-for-speed-overdrive.onrender.com](https://need-for-speed-overdrive.onrender.com)**
* **GitHub Repository:** [github.com/axadullayev01-commits/need-for-speed](https://github.com/axadullayev01-commits/need-for-speed)
* **Hosting Platformasi:** Render.com (Frankfurt Region - past kechikish / ping)
* **CI/CD:** GitHub `main` tarmog'iga push qilinganda avtomatik qayta yig'iladi va jonlanadi.

---

## 📌 1. Texnologiyalar Steki (Tech Stack)

| Qatlam | Texnologiya | Vazifasi va Afzalliklari |
| :--- | :--- | :--- |
| **Frontend 3D Dvigatel** | **Three.js (WebGL)** | 3D poyga trassasi, dinamik yorug'lik, tuman, past-poligonal sport avtomobillari, aylanuvchi g'ildiraklar va tormoz chiroqlarini render qilish. |
| **Backend & Tarmoq** | **Node.js + Express** | Statik fayllarni uzatish, API endpointlari va HTTP server boshqaruvi. |
| **Real-Time Aloqa** | **Socket.io (WebSockets)** | Server va mijozlar o'rtasida 60 Hz simulyatsiya va 30 Hz holat snapshotlarini uzatish. |
| **Ovoz Tizimi** | **Web Audio API** | Hech qanday tashqi `.mp3` fayllarsiz, procedural tarzda dvigatel ovozi (RPM ga mos pitch), drift vaqtidagi shinalar chinqirishi, to'qnashuv zarblari va start signallarini yaratish. |
| **Sinxronizatsiya** | **Client Prediction & Entity Interpolation** | Klientda 0 ms kechikish (zero input lag) bilan boshqaruv, vaqt sinxronizatsiyasi (`performance.now()`) va masofaviy mashinalar uchun silliq eksponensial harakat (*smooth damping*). |

---

## 🚀 2. Bajarilgan Barcha Ishlar va Yangilanishlar (Changelog)

### A. Server va Tarmoq Sinxronizatsiyasi:
1. **Authoritative 60 Hz Game Loop**: Har bir xonada (`GameRoom`) soniyasiga 60 marta fizik simulyatsiya aylanadi.
2. **Kadrlar Qaltirashi va Sakrashini (Jitter/Stuttering) Bartaraf Etish**:
   - Server va klient orasidagi tizim soati (clock skew) farqi yo'qotildi.
   - Tarmoq snapshotlari klientning mahalliy vaqti (`performance.now()`) orqali buferlanadi va 80ms barqaror interpolyatsiya bilan silliq ko'rsatiladi.
   - Do'stlarning mashinalari harakatiga eksponensial silliqlash (*smooth damping*) qo'shildi — kadrlar sakramaydi, mashinalar ipakdek silliq yuradi.
   - Klient-tomonlama xatolikni tuzatish (reconciliation) chegarasi yumshatildi.
3. **To'qnashuv Ovoz Spamini Tuzatish**:
   - Mashinalar bir-biriga tekkandan so'ng to'xtovsiz chiqadigan metall urilish ovozi to'g'rilandi — zarb ovozi faqat yangi to'qnashuv paytidagina yangraydi.
4. **Xonalar va Matchmaking (`RoomManager`)**:
   - 6 xonali noyob kodlar orqali xona yaratish (masalan, `TURBO9`).
   - Kod orqali mavjud xonaga do'stlarni qo'shish.
   - **Quick Match**: Bo'sh xonalarni avtomatik topib ulanish yoki yangi xona ochish.

### B. Aylanalar (Laps) va Marra Tizimi (Anti-Cheat):
1. **`0 / 3` Aylana Hisobi**:
   - Poyga boshlanganda hisoblagich `0 / 3` (aylana) dan boshlanadi.
   - Mashina trassani to'liq aylanib, har safar Start/Finish arkasidan o'tganda ketma-ket: `1 / 3` ➔ `2 / 3` ➔ `3 / 3` (Marra!) hisoblanadi.
2. **Kengaytirilgan Nazorat Nuqtalari (`checkLapProgressAndCrossing`)**:
   - Oldingi tor radiusdagi nazorat nuqtalari to'liq qayta ishlandi — endi drift vaqtida keng burilish yoki to'siqqa urilish yuz bersa ham, aylanalar yo'qolib ketmaydi yoki to'xtab qolmaydi.
   - Orqaga yurib marradan o'tish yoki trassani kesib o'tish aldovlariga qarshi (Anti-cheat) himoya mavjud.
3. **Marra (Finish), O'rinlar va Avtomatik To'xtash**:
   - 3 ta aylanani tugatgan o'yinchining poygasi o'sha lahzada to'xtaydi (boshqaruv klavishlari o'chiriladi, mashina silliq tormozlanadi va dvigatel ovozi o'chadi).
   - Ekranda o'yinchining egallagan o'rni katta va animatsiyali bannerda chiqadi:
     - 🥇 `🏆 1-O'RIN! SIZ G'OLIB BO'LDINGIZ!` (Oltin badge)
     - 🥈 `🥈 2-O'RIN! AJOYIB NATIJA!` (Kumush badge)
     - 🥉 `🥉 3-O'RIN!` (Bronza badge)
     - `🏁 MARRAGA YETIB KELDINGIZ (#4-O'RIN)`
   - Shundan so'ng barcha ishtirokchilarning natijalari va aylanalar vaqtlari yozilgan taqdirlash shohsupasi jadvali (Results Podium) ochiladi.
   - Boshqa ishtirokchilar esa o'z poygalarini to'xtovsiz davom ettirib, o'z vaqtida marraga kirishi mumkin.

### C. Frontend va 3D Grafika:
1. **Grand Prix 3D Trassasi (`TrackBuilder`)**:
   - Silliq asfalt yo'l qoplamasi va burilishlardagi qizil-oq apeks bordyurlari (curbs).
   - Metall himoya to'siqlari (Armco guardrails).
   - Start/Finish arkasi va shaxmat naqshli marra chizig'i.
   - Projeltor minoralari (stadium floodlights) va tungi poyga muhiti.
2. **3D Sport Avtomobili Modeli (`CarModel`)**:
   - Aerodinamik kuzov (rangini lobbida o'zgartirish mumkin).
   - Old g'ildiraklarning burilishga qarab qayrilishi va harakat tezligiga qarab 4 ta g'ildirakning aylanishi.
   - Tormoz bosilganda qizil yonuvchi orqa chiroqlar (emissive brake lights).
   - Mashina tepasida suzuvchi o'yinchi nomi (billboard nameplate).
   - Burilishlarda kuzovning real egilishi (body roll suspension).
3. **Kamera Tizimi (`Renderer`)**:
   - **C** tugmasi orqali 4 xil kamera rejimi: Dinamik Orqa Kamera (tezlikka qarab FOV kengayishi bilan), Yaqin Kamera, Kapot/Bumper (1-shaxs) va Yuqoridan ko'rinish (Top-down).
4. **HUD va Boshqaruv Paneli (`UI`)**:
   - Raqamli va kamon shaklidagi spidometr (KM/H) hamda avtomatik uzatmalar qutisi indikatori (`R, 1, 2, 3, 4, 5, 6`).
   - Jonli 2D radar mini-xaritasi (barcha o'yinchilar nuqtalar bilan ko'rinadi).
   - Jonli peshqadamlar jadvali (standings), aylanalar hisoblagichi va poyga taymeri.
   - Drift bonusi va poyga start hisoblagichi (`3... 2... 1... GO!`).
   - Rul boshqaruvi (`A` - chapga, `D` - o'ngga) Three.js koordinatalariga mos to'g'rilangan.

---

## 📁 3. Loyiha Fayllari Strukturasi va Vazifalari

```
need for speed/
├── .gitignore                 # node_modules va kesh fayllarni e'tiborsiz qoldirish
├── package.json               # Loyiha sozlamalari, Express va Socket.io kutubxonalari
├── README.md                  # Ushbu to'liq loyiha yo'riqnomasi
│
├── server/                    # 🛡️ AUTHORITATIVE BACKEND (SERVER)
│   ├── config.js              # Server porti (process.env.PORT || 3000), 60Hz loop, fizika konstantalari
│   ├── TrackData.js           # Trassa koordinatalari, Catmull-Rom splayn, Finish & Lap tekshiruvi
│   ├── PhysicsEngine.js       # Avtomobil kinematikasi, kuchlar, drift ishqalanishi va to'qnashuvlar
│   ├── GameRoom.js            # Har bir xonaning 60 FPS o'yin sikli, aylanalar, reyting va marra boshqaruvi
│   ├── RoomManager.js         # Xonalar yaratish, qidirish, kod bo'yicha ulash va o'yinchilar marshruti
│   └── server.js              # Express HTTP + Socket.io serverining asosiy kirish fayli
│
└── public/                    # 🎮 FRONTEND (KLIENT)
    ├── index.html             # O'yin interfeysi, lobbi modallari, HUD, Finish banner va Canvas
    ├── css/
    │   └── style.css          # Kiberepank / NFS neon uslubidagi zamonaviy qora dizayn, podium va bannerlar
    └── js/
        ├── main.js            # Klient boshqaruvchisi (Game loop, xolatlar, butun tizimni bog'lovchi)
        ├── Network.js         # Socket.io orqali ma'lumot almashinuvi va ping o'lchash
        ├── InputManager.js    # Klaviaturadan buyruqlarni o'qish (WASD, Arrows, Space, R, C, M)
        ├── AudioManager.js    # Web Audio API sintizatori (dvigatel, drift va to'qnashuv tovushlari)
        ├── Renderer.js        # Three.js sahnasi, yorug'liklar, dinamik kuzatuvchi kameralar
        ├── TrackBuilder.js    # 3D yo'l, bordyurlar, himoya to'siqlari va projektorlar generatori
        ├── CarModel.js        # 3D sport mashinasi, aylanuvchi g'ildiraklar, chiroqlar, nomlar va silliqlash
        ├── ClientPrediction.js# Klientda kechikishsiz oldindan hisoblash va silliq interpolyatsiya
        └── UI.js              # Spidometr, 2D radar mini-karta, marra banneri, natijalar shohsupasi va modallar
```

---

## 🕹️ 4. O'yinni Boshqarish Tugmalari (Controls)

| Tugma | Vazifasi |
| :--- | :--- |
| **W** yoki **↑ (Yuqoriga)** | Gaz berish / Tezlanish (Throttle) |
| **S** yoki **↓ (Pastga)** | Tormoz / Orqaga harakat (Reverse) |
| **A** yoki **← (Chapga)** | Rulni **Chapga** burish |
| **D** yoki **→ (O'ngga)** | Rulni **O'ngga** burish |
| **SPACEBAR (Bo'sh joy)** | Qo'l tormozi (Drift / Zanos qilish) |
| **R** | Avtomobilni qayta tiklash (Respawn - trassa o'rtasiga xavfsiz qaytarish) |
| **C** | Kamera burchagini almashtirish (Chase ➔ Close ➔ Hood ➔ Top-Down) |
| **M** | Ovozni yoqish / o'chirish (Mute Audio) |

---

## ⚡ 5. O'rnatish va Ishga Tushirish (Lokal Muhitda)

### 1. Bog'liqliklarni o'rnatish:
Terminalda loyiha papkasiga kiring va buyruqni bajaring:
```bash
npm install
```

### 2. Serverni ishga tushirish:
```bash
npm start
```
*Dasturchi rejimida (auto-reload bilan):*
```bash
npm run dev
```

Lokal brauzerda ochish manzili: **`http://localhost:3000`**

---

## 👥 6. Do'stlar Bilan Multiplayer O'ynash

1. **Saytga kirish:**
   - Brauzeringizda **[https://need-for-speed-overdrive.onrender.com](https://need-for-speed-overdrive.onrender.com)** manziliga kiring.
2. **Xona ochish (Host):**
   - Ismingizni yozing, mashina rangini tanlang va **"+ Create Room"** tugmasini bosing.
   - Ekranda 6 xonali kod hosil bo'ladi (masalan, `RACER7`). Kodni ustiga bosib nusxalang va do'stlaringizga yuboring.
3. **Do'stlarning ulanishi (Join):**
   - Do'stlaringiz o'z kompyuteridan saytga kiradi, ism tanlab, **"Join with Code"** tugmasi orqali xona kodini kiritadi.
4. **Poygani boshlash:**
   - Barcha o'yinchilar **"Ready Up"** tugmasini bosadi.
   - Xona egasi **"🏁 Start Race"** tugmasini bosishi bilan hamma ekranda `3... 2... 1... GO!` sanog'i bilan poyga boshlanadi!

---

## 🛣️ 7. Kelgusi Bosqichlar Uchun Rejalar (Roadmap)

- [ ] **Nitro (NOS Boost)**: `Shift` tugmasini bosganda qisqa muddatli kuchli tezlanish va ko'k olov zarralari.
- [ ] **Yangi Trassalar**: Shahar ko'chalari (City Night), Cho'l kanyoni (Desert Canyon) kabi turli xil trassalar tanlovi.
- [ ] **Mashina Turlari**: Turli xil xususiyatlarga ega yangi sportkar modellari (Supercar, Muscle car, Drift car).
- [ ] **AI Botlar**: Xonada boshqa jonli o'yinchilar bo'lmaganda avtomatik harakatlanuvchi kompyuter raqiblari (AI racers).
- [ ] **Tashqi Musiqa**: Poyga davomida fon musiqa treklari (.mp3/ogg) qo'yish imkoniyati.
