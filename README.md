# Bazarse Admin & Delivery Platform

This monorepo contains the Node.js backend API and the Vite + React frontend for the Bazarse admin and delivery control panel.

## Project Structure

```
.
├── backend
│   ├── src
│   │   ├── config
│   │   ├── controllers
│   │   ├── middleware
│   │   ├── routes
│   │   ├── services
│   │   └── utils
│   ├── package.json
│   └── server.js
├── frontend
│   ├── public
│   ├── src
│   │   ├── components
│   │   ├── context
│   │   ├── hooks
│   │   ├── pages
│   │   ├── services
│   │   └── styles
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Getting Started

### Backend API

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Copy `.env` and provide your own secrets.

3. Start the development server:

   ```bash
   npm run dev
   ```

### Frontend

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite dev server:

   ```bash
   npm run dev
   ```

The frontend is configured to proxy `/api` requests to `http://localhost:5000` during development.
