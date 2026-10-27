# 🏎️ NEED FOR SPEED // OVERDRIVE
### Real-Time Multiplayer 3D Car Racing Game (Authoritative Server Architecture)

> **Loyiha haqida qisqacha (O'zbekcha):**
> Ushbu loyiha brauzerda real vaqt rejimida (real-time) ishlovchi, ko'p o'yinchili (multiplayer) 3D poyga o'yini hisoblanadi. Loyiha **Authoritative Server Architecture** (server to'liq nazorati ostida) asosida qurilgan bo'lib, o'yinchilarning harakatlari, to'qnashuvlar (collisions), drift fizikasi va marra chiziqlari server tomonidan 60 FPS chastotada tekshiriladi va xakerlik/aldovlarning (anti-cheat) oldi olinadi.

---

## 📌 1. Texnologiyalar Steki (Tech Stack)

| Qatlam | Texnologiya | Vazifasi va Afzalliklari |
| :--- | :--- | :--- |
| **Frontend 3D Dvigatel** | **Three.js (WebGL)** | 3D poyga trassasi, dinamik yorug'lik, tuman, past-poligonal sport avtomobillari, aylanuvchi g'ildiraklar va tormoz chiroqlarini render qilish. |
| **Backend & Tarmoq** | **Node.js + Express** | Statik fayllarni uzatish, API endpointlari va HTTP server boshqaruvi. |
| **Real-Time Aloqa** | **Socket.io (WebSockets)** | Server va mijozlar o'rtasida 60 Hz simulyatsiya va 30 Hz holat snapshotlarini uzatish. |
| **Ovoz Tizimi** | **Web Audio API** | Hech qanday tashqi `.mp3` fayllarsiz, procedural tarzda dvigatel ovozi (RPM ga mos pitch), drift vaqtidagi shinalar chinqirishi, to'qnashuv zarblari va start signallarini yaratish. |
| **Sinxronizatsiya** | **Client Prediction & Reconciliation** | Klientda 0 ms kechikish (zero input lag) bilan boshqaruv va server snapshotlari asosida xatoliklarni yumshoq to'g'rilash (entity interpolation). |

---

## 🚀 2. Bajarilgan Barcha Ishlar (Changelog & Completed Features)

### A. Server va Arxitektura:
1. **Authoritative 60 Hz Game Loop**: Har bir xonada (`GameRoom`) soniyasiga 60 marta fizik simulyatsiya aylanadi.
2. **Xonalar va Matchmaking (`RoomManager`)**:
   - 6 xonali noyob kodlar orqali xona yaratish (masalan, `SPEED7`).
   - Kod orqali mavjud xonaga ulanish.
   - **Quick Match**: Bo'sh xonalarni avtomatik topib ulanish yoki yangi xona ochish.
3. **Avtomobil Kinematikasi va Drift Fizikasi (`PhysicsEngine`)**:
   - Tezlanish, orqaga harakat (reverse), tormoz, aerodinamik qarshilik ($F_{\text{drag}} \propto v^2$) va sirpanish.
   - **Spacebar (Handbrake)** bosilganda shinalarning yonlama ushlash kuchi kamayib, mashina drift / zanos holatiga kiradi.
   - Trassa to'siqlari bilan to'qnashuv (restitution $e = 0.35$) va mashinalarning bir-biri bilan to'qnashuvi ($e = 0.5$).
4. **Marra va Aylanalar Tizimi (Anti-Cheat Lap & Checkpoints)**:
   - Trassa bo'ylab 14 ta yo'naltirilgan nazorat nuqtalari (checkpoints).
   - O'yinchilar trassani qisqartirib o'tish yoki orqaga haydash orqali alday olmaydi.
   - Jonli reyting (Leaderboard) har bir o'yinchining aylanasi, bosib o'tgan nazorat nuqtasi va masofasiga qarab aniqlanadi.

### B. Frontend va 3D Grafika:
1. **Grand Prix 3D Trassasi (`TrackBuilder`)**:
   - Silliq asfalt yo'l qoplamasi va burilishlardagi qizil-oq apeks bordyurlari (curbs).
   - Metall himoya to'siqlari (Armco guardrails).
   - Start/Finish arkasi va shaxmat naqshli marra chizig'i.
   - Projeltor minoralari (stadium floodlights) va tungi poyga muhiti.
2. **3D Sport Avtomobili Modeli (`CarModel`)**:
   - Aerodinamik kuzov (rangini lobbida o'zgartirish mumkin).
   - Old g'ildiraklarning burilishga qarab qayrilishi.
   - Harakat tezligiga qarab 4 ta g'ildirakning aylanishi.
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
   - Marra yakunida taqdirlash shohsupasi (Podium results table).
5. **Rul Boshqaruvi Tuzatildi (Steering Bugfix)**:
   - Three.js koordinatalar sistemasidagi o'ng qo'l qoidasi tufayli `A` va `D` tugmalari teskari ishlab qolgan edi. [InputManager.js](file:///C:/Users/user/Desktop/need%20for%20speed/public/js/InputManager.js) ichida yo'nalish to'g'rilandi: endi `A` bosilganda chapga, `D` bosilganda o'ngga buriladi.

---

## 📁 3. Loyiha Fayllari Strukturasi va Vazifalari

```
need for speed/
├── package.json               # Loyiha sozlamalari, Express va Socket.io kutubxonalari
├── README.md                  # Ushbu to'liq loyiha yo'riqnomasi
│
├── server/                    # 🛡️ AUTHORITATIVE BACKEND (SERVER)
│   ├── config.js              # Server chastotasi (60Hz), fizika konstantalari, tezlik cheklovlari
│   ├── TrackData.js           # Trassa koordinatalari, Catmull-Rom splayn, nazorat nuqtalari (checkpoints)
│   ├── PhysicsEngine.js       # Avtomobil fizikasi, kuchlar, drift ishqalanishi va to'qnashuvlar
│   ├── GameRoom.js            # Har bir xonaning 60 FPS o'yin sikli, aylanalar va reyting hisobi
│   ├── RoomManager.js         # Xonalar yaratish, qidirish, kod bo'yicha ulash va o'yinchilar marshruti
│   └── server.js              # Express HTTP + Socket.io serverining asosiy kirish fayli
│
└── public/                    # 🎮 FRONTEND (KLIENT)
    ├── index.html             # O'yin interfeysi, lobbi modallari, HUD va Canvas konteyneri
    ├── css/
    │   └── style.css          # Kiberepank / NFS neon uslubidagi zamonaviy qora dizayn
    └── js/
        ├── main.js            # Klient boshqaruvchisi (Game loop, xolatlar, butun tizimni bog'lovchi)
        ├── Network.js         # Socket.io orqali ma'lumot almashinuvi va ping o'lchash
        ├── InputManager.js    # Klaviaturadan buyruqlarni o'qish (WASD, Arrows, Space, R, C, M)
        ├── AudioManager.js    # Web Audio API sintizatori (dvigatel, drift va to'qnashuv tovushlari)
        ├── Renderer.js        # Three.js sahnasi, yorug'liklar, dinamik kuzatuvchi kameralar
        ├── TrackBuilder.js    # 3D yo'l, bordyurlar, himoya to'siqlari va projektorlar generatori
        ├── CarModel.js        # 3D sport mashinasi, aylanuvchi g'ildiraklar, chiroqlar va nomlar
        ├── ClientPrediction.js# Klientda kechikishsiz oldindan hisoblash (prediction) va interpolyatsiya
        └── UI.js              # Spidometr, 2D radar mini-karta, peshqadamlar ro'yxati va modallar
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

## ⚡ 5. O'rnatish va Ishga Tushirish (Quick Start)

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

Server ishga tushgach konsolda quyidagi xabar chiqadi:
```text
  ==============================================================
    🏎️  NEED FOR SPEED // MULTIPLAYER CAR RACING SERVER 🏎️
  ==============================================================
    Status:      ONLINE
    Port:        3000
    URL:         http://localhost:3000
    Tick Rate:   60 Hz (Authoritative Physics)
    Broadcast:   30 Hz (Snapshots)
  ==============================================================
```

Brauzerda ochish manzili: **`http://localhost:3000`**

---

## 👥 6. Multiplayer Rejimini Test Qilish (Lokal Kompyuterda)

Bir kompyuterning o'zida bir nechta o'yinchi bo'lib ulanish va sinash:

1. **1-O'yinchi (Xona egasi / Host)**:
   - Brauzeringizda `http://localhost:3000` manziliga kiring.
   - Ismingizni yozing (masalan, `Racer1`), mashinangiz rangini tanlang va **"+ Create Room"** tugmasini bosing.
   - Ekranda 6 xonali kod hosil bo'ladi (masalan, `TURBO9`). Ushbu kod ustiga bosib nusxalang.
2. **2-O'yinchi (Raqib)**:
   - Brauzerning **Incognito (Maxfiy)** oynasini yoki boshqa brauzerni (masalan, Edge) oching.
   - `http://localhost:3000` ga kiring.
   - Ism yozing (masalan, `Racer2`), boshqa rang tanlang, **"Join with Code"** tugmasini bosib, xona kodini kiriting va **"Join Room"** tugmasini bosing.
3. **Poygani boshlash**:
   - Har ikki o'yinchi lobbida paydo bo'ladi.
   - 2-o'yinchi **"Ready Up"** tugmasini bosadi.
   - Xona egasi (Host) **"🏁 Start Race"** tugmasini bosadi.
   - Har ikki ekranda bir vaqtning o'zida `3... 2... 1... GO!` sanog'i yangraydi va 3D poyga boshlanadi!

---

## 🛣️ 7. Kelgusi Bosqichlar Uchun Rejalar (Roadmap)

Keyingi safar ushbu loyiha ustida ishlashni davom ettirmoqchi bo'lsangiz, quyidagi yangi imkoniyatlarni qo'shishimiz mumkin:
- [ ] **Nitro (NOS Boost)**: `Shift` tugmasini bosganda qisqa muddatli kuchli tezlanish va ko'k olov zarralari.
- [ ] **Yangi Trassalar**: Shahar ko'chalari (City Night), Cho'l kanyoni (Desert Canyon) kabi turli xil trassalar tanlovi.
- [ ] **Mashina Turlari**: Turli xil xususiyatlarga ega (Maksimal tezlik, Burilish, Boshqaruv) yangi sportkar modellari (Supercar, Muscle car, Drift car).
- [ ] **AI Botlar**: Xonada boshqa jonli o'yinchilar kam bo'lsa, avtomatik trassada harakatlanuvchi kompyuter raqiblari (AI racers).
- [ ] **Tashqi Ovozlar**: Haqiqiy motor va fon musiqa (.mp3/ogg) treklarini qo'shish imkoniyati.

---

> **Eslatma:** Ushbu fayl loyihaning to'liq pasporti hisoblanadi. Keyingi muloqotda "README ga qarab loyihani davom ettiraylik" desangiz, men darhol barcha fayllar va arxitekturani to'liq tushunib ishga kirishaman!
