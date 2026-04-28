# Architecture & Data Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DELIVERY PARTNER                         │
│                    (Web Dashboard)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
      LOGIN          TOGGLE          GET PROFILE
        │             STATUS            │
        │              │                │
        │              ▼                │
        │    ┌──────────────────┐       │
        │    │ Show Loading     │       │
        │    │ Send to Backend  │       │
        │    └────────┬─────────┘       │
        │             │                 │
        ▼             ▼                 ▼
   ┌────────────────────────────────────────────┐
   │      Backend API Layer (Express.js)        │
   ├────────────────────────────────────────────┤
   │  POST   /api/delivery/login                │
   │  GET    /api/delivery/profile              │
   │  PATCH  /api/delivery/status               │
   │  GET    /api/admin/delivery-partners       │
   │  POST   /api/admin/assignments (GUARDED)   │
   └────────────────────┬───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
   ┌──────────────┐          ┌──────────────────────┐
   │ Supabase SQL │          │  Validation Layer    │
   ├──────────────┤          ├──────────────────────┤
   │ Query        │          │ Joi Schemas          │
   │ Update       │          │ Business Logic       │
   │ Validate     │          │ Guards               │
   └────────┬─────┘          └──────────┬───────────┘
            │                           │
            └───────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ delivery_partners table        │
        ├───────────────────────────────┤
        │ id                            │
        │ name                          │
        │ email                         │
        │ phone                         │
        │ password_hash                 │
        │ vehicle_type                  │
        │ is_active                     │
        │ delivery_status (NEW)         │ ◄─── 'online' | 'offline'
        │ created_at                    │
        └───────────────────────────────┘
```

---

## Login Flow with Status

```
Step 1: Partner Login
┌──────────────┐
│ Email + Pass │
└──────┬───────┘
       │
       ▼
   Query: delivery_partners WHERE email=? AND is_active=true
   ▼
   Verify Password
   ▼
   Return: {
     token,
     partner: {
       id, name, email, vehicle_type,
       delivery_status ← (actual from DB or default 'online')
     }
   }
   ▼
   ┌─────────────────────┐
   │ Frontend receives:  │
   │ delivery_status     │
   └─────────────────────┘


Step 2: Dashboard Mount
┌──────────────────────┐
│ DeliveryDashboard    │
│ useEffect on mount   │
└─────────┬────────────┘
          │
          ▼
    Call getProfile()
          │
          ▼
    GET /api/delivery/profile
          │
          ▼
    Query: SELECT ... FROM delivery_partners WHERE id=?
          │
          ▼
    Get delivery_status from DB
          │
          ▼
    Set isOnline = (delivery_status === 'online')
          │
          ▼
    ┌──────────────────────┐
    │ UI reflects actual   │
    │ DB status            │
    └──────────────────────┘
```

---

## Toggle Online/Offline Flow

```
UI Action: Click "Go Offline"
│
▼
handleStatusToggle()
│
├─ Calculate newStatus: isOnline ? 'offline' : 'online'
├─ setIsUpdatingStatus(true)
├─ Button disables, shows "..."
│
▼
updateDeliveryStatus(newStatus)
│
▼
PATCH /api/delivery/status
│ Body: { delivery_status: 'offline' }
│
▼
Backend Validation
├─ Joi schema validates value
└─ Only 'online' | 'offline' accepted
│
▼
Database Update
│
├─ UPDATE delivery_partners 
│  SET delivery_status = 'offline'
│  WHERE id = partner_id
│
▼
Return Success
│
▼
Frontend receives response
│
├─ setIsOnline(false)
├─ setIsUpdatingStatus(false)
├─ Button re-enables
│
▼
Status persisted! ✅
Survives refresh/logout/login
```

---

## Seller Assignment Flow

```
Admin Requests Available Partners
│
▼
GET /api/admin/delivery-partners
│
▼
Backend Query:
┌─────────────────────────────────────┐
│ SELECT id, name, email, phone,      │
│        vehicle_type, is_active,     │
│        delivery_status, created_at  │
│ FROM delivery_partners              │
│ WHERE delivery_status = 'online'    │ ◄─── Filter here!
│   AND is_active = true              │
│ ORDER BY created_at DESC            │
└─────────────────────────────────────┘
│
▼
Return only online, active partners
│
▼
┌──────────────────────────┐
│ Seller Panel             │
│ Shows available partners │
│ (Offline ones hidden)    │
└──────────────────────────┘
│
▼
If Admin tries direct API to assign offline partner:
│
POST /api/admin/assignments
│ Body: { order_id, delivery_partner_id }
│
▼
Backend Guard Checks
├─ Is partner in DB? ✅
├─ Is partner active? ✅
├─ Is partner ONLINE? ❌ ← Check fails!
│
▼
Reject with 409:
"Cannot assign order to offline delivery partner"
```

---

## State Management (Frontend)

```
┌─────────────────────────────────────────────┐
│         DeliveryDashboard Component         │
├─────────────────────────────────────────────┤
│ const [isOnline, setIsOnline]               │
│   = useState(null) ← null = loading          │
│                                             │
│ const [isUpdatingStatus, setIsUpdatingStatus│
│   = useState(false) ← false = ready          │
│                                             │
│ useEffect(() => {                           │
│   // On mount: fetch profile                │
│   getProfile().then(profile => {            │
│     setIsOnline(                            │
│       profile.delivery_status === 'online'  │
│     )                                       │
│   })                                        │
│ }, [])                                      │
│                                             │
│ const handleStatusToggle = async () => {    │
│   setIsUpdatingStatus(true)                 │
│   // Button disables ↓                      │
│   try {                                     │
│     await updateDeliveryStatus(newStatus)   │
│     setIsOnline(!isOnline) ← Update UI      │
│   } catch(err) {                            │
│     // Don't toggle UI on error             │
│   } finally {                               │
│     setIsUpdatingStatus(false)              │
│   }                                         │
│ }                                           │
└─────────────────────────────────────────────┘
            │
            ▼
    ┌────────────────────┐
    │ DeliveryStatus     │
    │ Buttons Component  │
    ├────────────────────┤
    │ Props:             │
    │  - isOnline        │
    │  - onToggle        │
    │  - isUpdating      │
    ├────────────────────┤
    │ When isUpdating:   │
    │  - Button disabled │
    │  - Text = "..."    │
    │  - Prevent clicks  │
    └────────────────────┘
```

---

## Database Schema - Before & After

### Before ❌
```
delivery_partners
├─ id              (UUID, PK)
├─ name            (VARCHAR)
├─ email           (VARCHAR, UNIQUE)
├─ phone           (VARCHAR)
├─ password_hash   (VARCHAR)
├─ vehicle_type    (VARCHAR)
├─ is_active       (BOOLEAN) ← Only way to control visibility
└─ created_at      (TIMESTAMP)
```

### After ✅
```
delivery_partners
├─ id              (UUID, PK)
├─ name            (VARCHAR)
├─ email           (VARCHAR, UNIQUE)
├─ phone           (VARCHAR)
├─ password_hash   (VARCHAR)
├─ vehicle_type    (VARCHAR)
├─ is_active       (BOOLEAN)
├─ delivery_status (VARCHAR) ← NEW! 'online' | 'offline'
│                              CHECK constraint
│                              DEFAULT 'online'
│                              NOT NULL
└─ created_at      (TIMESTAMP)
```

---

## Complete Data Journey

```
┌─────────────┐
│   Partner   │
│   Logs In   │
└──────┬──────┘
       │
       ▼
   Backend returns delivery_status
       │
       ▼
┌─────────────────────────┐
│ Frontend Stores in      │
│ React Component State   │
│ (setIsOnline)           │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ User sees correct       │
│ status in UI            │
│ (Online/Offline)        │
└──────┬──────────────────┘
       │
       ▼
   User Refreshes
       │
       ▼
┌─────────────────────────┐
│ getProfile() is called  │
│ again (useEffect)       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Fetches fresh status    │
│ from database           │
│ (not from memory)       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ ✅ Status persists!     │
│ Same as before refresh  │
└─────────────────────────┘
```

---

## Error Handling Flow

```
User clicks toggle
│
▼
Try to update status
│
├─ Network error?
│  ↓
│  Show error message
│  Don't toggle UI
│  Keep previous state
│  ✅ Safe!
│
├─ Validation error (invalid status)?
│  ↓
│  Show error message
│  Don't toggle UI
│  Keep previous state
│  ✅ Safe!
│
├─ Server error?
│  ↓
│  Show error message
│  Don't toggle UI
│  Keep previous state
│  ✅ Safe!
│
└─ Success!
   ✅
   Toggle UI
   Status matches DB
   All good!
```

---

## Security Layers

```
┌─────────────────────────────────────────────┐
│           Frontend Validation               │
│  - Check value is 'online' or 'offline'     │
│  - Check network request succeeded          │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│          Authorization Check                │
│  - Verify JWT token present                 │
│  - Verify user is delivery partner          │
│  - Verify endpoint requires auth            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│        Request Body Validation (Joi)        │
│  - delivery_status must be string           │
│  - Value must be 'online' or 'offline'      │
│  - Field is required                        │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│       Business Logic Validation             │
│  - Partner exists                           │
│  - Partner is active                        │
│  - For assignment: partner must be online   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│         Database Constraint                 │
│  - CHECK constraint: only valid values      │
│  - NOT NULL: always has a value             │
│  - DEFAULT 'online': sensible default       │
└─────────────────────────────────────────────┘
```

---

## Key Points Summary

1. **Status lives in Database** - Not in memory or localStorage
2. **Loaded on Every Page Load** - Fresh from DB, not cached
3. **Updated Synchronously** - DB first, then UI (not optimistic)
4. **Filters Results** - Offline partners hidden from seller
5. **Guards Assignments** - Backend prevents offline assignment
6. **Error Safe** - Doesn't toggle UI on error
7. **Loading Indication** - Shows "..." while updating

