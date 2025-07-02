# 🏏 Real-time Cricket Team Selection App

A real-time multiplayer application where users can create or join a room and take turns selecting cricket players to form their team. This project uses:

* **Frontend**: Next.js with TypeScript
* **Backend**: Node.js + Express + Socket.IO (WebSockets)

---

## 🔗 Live Links

* **Frontend (Next.js)**: [Frontend Deployment Link Here](#)
* **Backend (Socket.IO API)**: [Backend Deployment Link Here](#)

---

## 🚀 Features

* Create or join rooms
* Real-time user list updates
* Turn-based player selection with countdown
* Auto-selection if time runs out
* Final team display after selection ends
* Disconnect handling

---

## 🖥️ Tech Stack

### Frontend

* Next.js (React + SSR)
* TypeScript
* Socket.IO client

### Backend

* Node.js
* Express
* Socket.IO (WebSockets)

---

## 📦 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/abdullashahil/Shotgun_Real-time_toss
cd Shotgun_Real-time_toss
```

### 2. Backend Setup (Socket.IO Server)

```bash
cd server
npm install
npm run dev
```

* Runs on `http://localhost:4000`

### 3. Frontend Setup (Next.js Client)

```bash
cd client
npm install
npm run dev
```

* Runs on `http://localhost:3000`

---

## ⚙️ Environment Variables

### Backend

In `.env`:

```env
PORT=8000
```

### Frontend

In `.env.local`:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

---

## 🧪 Development Notes

* Keep at least 2 players in a room to start selection.
* Every player can select 5 cricketers.
* Turn is skipped(auto selected) automatically after 10 seconds.

---

## 🛠️ Folder Structure

```
project-root
├── client/        # Next.js frontend (TypeScript)
└── server/         # Express + Socket.IO backend
```

---
