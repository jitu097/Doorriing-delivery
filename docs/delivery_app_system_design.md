# Delivery System Architectural Analysis & Standalone App Design

This document details the current state of the Admin & Delivery integration and provides a comprehensive architectural blueprint for extracting the Delivery system into a dedicated mobile application with a robust notification engine.

---

## 1. Admin & Delivery Current System

The current system is a monolithic web architecture where both Admin and Delivery Partner functions reside within the same codebase, differentiated by roles and conditional routing.

### Account Creation & Management
*   **Actor:** Admin.
*   **Flow:** The Admin creates delivery person accounts via the Admin Dashboard.
*   **Mechanism:** `POST /api/admin/delivery-partners` (calls `adminService.createDeliveryPartner`).
*   **Data Fields:** `name`, `email`, `phone`, `password_hash`, `vehicle_type`, `is_active`.
*   **Login System:** ID (Email) + Password based. The backend uses JWT with a `role: 'delivery'` claim to authorize access to delivery-specific routes.

### Storage Architecture (Supabase)
Currently, delivery data is spread across three primary tables:

1.  **`delivery_partners`**: Core profile data and credentials.
    *   `id` (UUID, Primary Key)
    *   `name`, `email`, `phone`
    *   `password_hash`
    *   `vehicle_type` (e.g., bike, scooter, van)
    *   `is_active` (Boolean)
2.  **`order_delivery_assignments`**: The link between orders and riders.
    *   `id`, `order_id`, `delivery_partner_id`
    *   `status` (`assigned`, `accepted`, `picked_up`, `out_for_delivery`, `delivered`)
    *   Timestamps: `assigned_at`, `accepted_at`, `picked_up_at`, `delivered_at`
3.  **`orders`**: General order table where delivery status is synced.

---

## 2. Delivery Flow Breakdown

The lifecycle of a delivery currently follows a strict state-machine transition:

| Step | Action | API Called | DB Updates | Status Change |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Order Created | User Flow | `orders` (insert) | `pending` |
| **2** | Admin Assigns Rider | `POST /api/admin/assignments` | `order_delivery_assignments` (insert) | assignment: `assigned` |
| **3** | Rider Accepts | `POST /api/delivery/orders/:id/accept` | `order_delivery_assignments` (update) | assignment: `accepted` |
| **4** | Rider Picked Up | `POST /api/delivery/orders/:id/picked-up` | `order_delivery_assignments`, `orders` | order: `out_for_delivery` |
| **5** | Rider Out for Del. | `POST /api/delivery/orders/:id/out-for-delivery`| `order_delivery_assignments` | assignment: `out_for_delivery` |
| **6** | Rider Delivered | `POST /api/delivery/orders/:id/delivered` | `order_delivery_assignments`, `orders` | order/assignment: `delivered` |

---

## 3. Notification Analysis (Delivery Side)

### Current Implementation
*   **Status:** **NOT IMPLEMENTED**.
*   The current "Delivery Web Panel" relies on manual page refreshes or polling to see new assignments.
*   **Missing Trigger:** There is no logic in the backend to push alerts to the delivery partner when an order is assigned or ready.

### Where Should it Trigger?
Logically, the trigger must exist in the **Assignment Service**.
*   **Trigger 1:** Immediately after `adminService.assignDeliveryPartner` inserts a record.
*   **Trigger 2:** When a Shop marks an order as `ready` (if applicable), notifying the already assigned partner.

---

## 4. Current Limitations & Gaps

To build a professional Delivery App, the following gaps must be closed:

1.  **Missing FCM Infrastructure:** No table exists to store device-specific push tokens for delivery partners.
2.  **No Real-Time Hooks:** The backend does not emit events (WebSockets or FCM) during the assignment phase.
3.  **Killed-State Handling:** Since it's currently a Web App, it cannot receive notifications if the browser tab is closed or the phone is locked.
4.  **Backend Auth Coupling:** The login logic is heavily tied to the monolithic server which might need separate rate-limiting for app-based login.

---

## 5. Delivery App Architecture Plan

### A. Authentication Model
*   **Recommendation:** Keep **ID + Password** for initial migration to maintain compatibility with Admin creation flow.
*   **Improvement:** Implement **Refresh Tokens** and **Long-lived sessions** (JWT) so riders aren't logged out mid-shift.
*   **Device Binding:** Optional but recommended—link the session to a specific device ID to prevent multi-logins.

### B. Database Schema Design (New Tables)

#### `delivery_notification_tokens`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `delivery_partner_id`| UUID | FK to `delivery_partners` |
| `fcm_token` | String | Unique FCM token from device |
| `device_id` | String | Unique hardware ID |
| `platform` | String | `android` / `ios` |
| `last_used_at` | Timestamp | For token cleanup |

#### `delivery_notifications`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `delivery_partner_id`| UUID | Target |
| `title` | String | e.g., "New Assignment" |
| `body` | String | e.g., "Order #123 assigned to you" |
| `data` | JSONB | Payload: `{ order_id: '...', type: 'NEW_ORDER' }` |
| `is_read` | Boolean | Read status for in-app inbox |

---

## 6. Delivery Notification Events (Trigger Matrix)

| Event | Trigger Point (Backend) | Receiver | Payload Type |
| :--- | :--- | :--- | :--- |
| **New Assignment** | `adminService.assignDeliveryPartner` | Assigned Rider | `DATA + NOTIFICATION` (High Priority) |
| **Assignment Cancelled**| `adminService.removeAssignment` | Previously Assigned | `DATA` (Silent update to UI) |
| **Order Ready** | `shopService.markReady` | Assigned Rider | `NOTIFICATION` |
| **Payout Processed** | `adminService.approvePayout` | Involved Rider | `NOTIFICATION` |

---

## 7. Proposed Complete Notification Flow

1.  **On App Start/Login:** The Delivery App fetches the FCM token and sends it to `POST /api/delivery/push-token`.
2.  **Persistence:** Backend updates `delivery_notification_tokens` (Upsert logic by `device_id`).
3.  **Trigger:** When Admin assigns an order:
    *   Backend fetches all valid `fcm_tokens` for the `delivery_partner_id`.
    *   Constructs a **combined Notification + Data payload**.
4.  **Delivery State Handling:**
    *   **Foreground:** App shows in-app popup + sound.
    *   **Background:** OS displays system tray notification.
    *   **Killed State:** **Firebase High-Priority FCM** wakes up the background service (via Native Android/iOS handlers) to ensure the rider sees the "New Task" alert immediately.

---

## 8. Admin Role & Backend Changes

### Admin Responsibilities
*   **Creation:** Continue using the existing "Create Rider" UI.
*   **Monitoring:** Admin must be able to see if a rider's device is "Push Ready" (token exists in DB).
*   **Manual Alert:** Add a "Nudge" button in Admin UI to re-send the assignment notification if a rider hasn't responded.

### Necessary API Changes
1.  `[NEW] POST /api/delivery/push-token`: Register/Update device token.
2.  `[MODIFY] adminService.assignDeliveryPartner`: Add a hook to call `deliveryNotificationService.sendAssignmentAlert()`.
3.  `[NEW] GET /api/delivery/notifications`: Fetch history of alerts for the in-app "Alerts" tab.

---

## 9. Risks & Failure Points ⚠️

1.  **Token Rotation:** Riders changing phones or clearing cache.
    *   *Fix:* Implement `onNewToken` update logic in the app.
2.  **Assignment Desync:** Admin assigns Order A, but notification fails. Rider doesn't know.
    *   *Fix:* Implement a "Pull-to-refresh" fallback and a WebSocket (Socket.io) for active sessions.
3.  **Battery Optimization:** Android "Doze mode" killing background sync.
    *   *Fix:* Use **High Priority** FCM data messages and request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission if necessary.
4.  **Network Dead Zones:** Rider in a basement/elevator when assigned.
    *   *Fix:* Persistence in `delivery_notifications` table allows the rider to see missed assignments as soon as they regain connectivity.

---

## 10. Success Metrics for Delivery App
*   **Average Response Time:** Time taken from Admin Assignment to Rider Acceptance.
*   **Notification Delivery Rate:** Percentage of FCM messages successfully acknowledged by devices.
*   **Active Session Time:** Tracking how long riders stay online in the app.
