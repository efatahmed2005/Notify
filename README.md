# 📢 Notifyy: Real-Time Notice Management System

[![Android Native](https://img.shields.io/badge/Android-Native-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/ayshakotha/notify)
[![Web Dashboard](https://img.shields.io/badge/Web_Dashboard-HTML5_|_JS-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://github.com/ayshakotha/notify)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://github.com/ayshakotha/notify)

Notifyy is a zero-latency, cross-platform automated notice broadcasting and management system. Built to replace traditional paper-based bulletin boards and cluttered chat applications, it provides a centralized platform for academic faculty to publish structured announcements that instantly synchronize across connected student devices.

## ✨ Core Features

*   **Zero-Latency Broadcasting:** Powered by an event-driven NoSQL backend, data propagation delays are kept strictly under 500 milliseconds to ensure immediate visibility.
*   **Zero-Refresh Dynamic UI:** Persistent Web-Socket connections allow the DOM and Android user interfaces to update instantaneously upon database mutations without requiring manual page reloads or polling.
*   **Role-Based Access Control:** Secure, segmented routing ensures only authorized faculty can publish or modify announcements, while students are restricted to a read-only live feed.
*   **Robust Input Validation:** Strict client-side validation logic automatically rejects empty or malformed title and message payloads before they consume server resources.

## 🏗️ System Architecture

The application relies on a lightweight, bidirectional Client-Server architecture utilizing **Firebase Real-Time Database** as the cloud middleware. 

When an authorized user publishes a notice via the Android Publisher Module, the payload is written directly to the NoSQL JSON tree. Connected consumer clients (both the Android Live Feed Activity and the Web Dashboard) utilize continuous event listeners to immediately fetch, validate, and render these structural mutations onto the screen.

## 📂 Project Structure

The repository is highly modularized, separating the native mobile client, web client, and server configurations into distinct workspaces:

```text
notifyy-system/
├── android/                                # Android Native Client Workspace
│   ├── app/
│   │   ├── build.gradle
│   │   └── src/
│   │       └── main/
│   │           ├── AndroidManifest.xml
│   │           ├── java/com/institution/notifyy/
│   │           │   ├── data/               # DATA LAYER
│   │           │   │   ├── model/          # Data Classes
│   │           │   │   ├── remote/         # Firebase Realtime DB & Event Listener Logic
│   │           │   │   └── repository/     # Data Abstraction Layer
│   │           │   ├── ui/                 # PRESENTATION LAYER (MVVM Pattern)
│   │           │   │   ├── role/           # Role Selection Activity & Logic
│   │           │   │   ├── teacher/        # Notice Creation Activity & ViewModel
│   │           │   │   ├── student/        # Live Feed Activity & ViewModel
│   │           │   │   └── adapter/        # RecyclerView Adapters for Notice Lists
│   │           │   └── utils/              # Shared Helpers (Input Validation, Toasts)
│   │           └── res/
│   │               ├── layout/             # XML Layouts
│   │               ├── drawable/           # Graphics, Icons, UI Assets
│   │               └── values/             # Colors, Strings, Themes
│   └── build.gradle
│
├── web/                                    # Web Dashboard Client Workspace
│   ├── assets/
│   │   ├── css/                            # Custom UI Styles & Layout Rules
│   │   └── js/                             # MODULAR ES6 JAVASCRIPT
│   │       ├── firebase-config.js          # Firebase SDK Setup & Database Reference
│   │       ├── notice-publisher.js         # Faculty Payload Submission & Validation
│   │       └── notice-subscriber.js        # Real-time WebSocket DOM Renderers
│   └── index.html                          # Responsive Dashboard View
│
├── firebase/                               # Cloud Backend Infrastructure Configuration
│   ├── database.rules.json                 # DB Access Control Rules & Data Schema Specs
│   └── firebase.json                       # Firebase CLI Hosting/DB Deployment Settings
│
├── .gitignore                              
└── README.md