# Bazarse Admin & Delivery Panel - System Analysis

This document provides a comprehensive overview of the Admin and Delivery platform, detailing the frontend architecture, backend API, and core modules.

## 🚀 Project Overview
The platform is a unified dashboard system designed for two primary roles:
1.  **Administrators**: To manage shops, users, orders, delivery partners, and platform-wide settings.
2.  **Delivery Partners (Couriers)**: To manage assigned orders, track active deliveries, and view history.

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Data Fetching**: Axios
- **PWA**: Vite PWA Plugin (Offline support & Manifest)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT (JSON Web Tokens)
- **Push Notifications**: Firebase Admin SDK
- **Validation**: Joi
- **Security**: Helmet, CORS, BcryptJS
- **Logging**: Winston & Morgan

---

## 📦 Admin Panel Modules

### 1. Dashboard
- **Route**: `/admin/dashboard`
- **Key Features**:
  - High-level metrics (Total Orders, Active Shops, Total Revenue).
  - Quick glance at platform health.

### 2. Shops Management
- **Routes**: `/admin/shops`, `/admin/shops/:shopId`
- **Key Features**:
  - List all registered shops.
  - **Shop Details**:
    - Detailed analytics and order history.
    - Withdrawal management (Approve/Reject requests).
    - Block/Unblock shop status.
    - View specific shop stats (Commission, Total Sales).

### 3. Users Management
- **Route**: `/admin/users`
- **Key Features**:
  - Search and filter application users.
  - View user profile details.
  - Block/Unblock users to control access.

### 4. Orders Overview
- **Route**: `/admin/orders`
- **Key Features**:
  - Global list of all orders across all shops.
  - Filter by status (Pending, Preparing, Ready, Picked up, Delivered, Cancelled).
  - Detailed order analysis and trends.

### 5. Delivery Partners
- **Route**: `/admin/delivery-partners`
- **Key Features**:
  - Manage courier accounts.
  - Add new delivery partners.
  - Toggle partner availability/status.
  - Assign couriers to specific orders manually.

### 6. Platform Settings
- **Route**: `/admin/settings`
- **Key Features**:
  - Configure global commission rates.
  - Minimum withdrawal amounts.
  - Operational parameters (Maintenance mode, App versions).
  - Direct integration with Supabase for real-time config updates.

---

## 🚚 Delivery Panel Modules

### 1. Delivery Dashboard
- **Route**: `/delivery/dashboard`
- **Key Features**:
  - Courier-specific stats (Today's earnings, Total deliveries).
  - Real-time availability toggle.

### 2. Assigned Orders
- **Route**: `/delivery/assigned`
- **Key Features**:
  - Incoming order requests with timers (e.g., 5-minute auto-decline).
  - Accept/Decline functionality.

### 3. Active Deliveries
- **Route**: `/delivery/active`
- **Key Features**:
  - Ongoing order tracking.
  - Status updates (Picked up -> Delivered).
  - Customer and Shop contact information.

### 4. Delivery History
- **Route**: `/delivery/history`
- **Key Features**:
  - Log of all completed and cancelled deliveries.
  - Detailed summary per delivery.

---

## 🛡 Security & Authentication
- **Role-Based Access Control (RBAC)**: Middleware validates if the user is an `admin` or `courier`.
- **JWT Protection**: All sensitive API routes require a valid Bearer token.
- **Request Validation**: Joi schemas ensure data integrity for all POST/PATCH/PUT requests.

---

## 📂 Project Structure
```text
/
├── backend/
│   ├── src/
│   │   ├── controllers/   # Business logic
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # DB & External integrations
│   │   ├── middleware/    # Auth & Validation
│   │   └── utils/         # Helpers & Constants
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI parts
│   │   ├── pages/         # Page components (Admin/Delivery)
│   │   ├── context/       # State management (Auth/Notifications)
│   │   ├── services/      # API client logic
│   │   └── config/        # Constants & Route configs
├── docs/                  # System documentation
└── android-app/           # WebView wrapper for the platform
```
