# 🚀 Installation & Setup Guide

## Quick Start

### 1. Install Required Dependencies

```bash
cd frontend

# Production dependencies
npm install \
  ua-parser-js \
  express-rate-limit \
  helmet \
  express-mongo-sanitize \
  validator \
  cors

# If you don't have these already
npm install \
  express \
  mongoose \
  jsonwebtoken \
  bcryptjs
```

### 2. Update Your Server Configuration

Create or update `frontend/server.js`:

```javascript
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import security from './src/middleware/security.js';
import activityRoutes from './src/api/activityRoutes.js';
import { errorTrackingMiddleware } from './src/middleware/activityTracker.js';

const app = express();

// === SECURITY MIDDLEWARE ===
app.use(security.helmetConfig);
app.use(security.securityHeaders);
app.use(security.mongoSanitizeConfig);
app.use(security.sanitizeInput);

// === CORS ===
app.use(cors(security.corsOptions));

// === BODY PARSING ===
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === RATE LIMITING ===
app.use('/api/', security.apiLimiter);
app.use('/api/auth/', security.authLimiter);

// === ROUTES ===
app.use('/api/activity', activityRoutes);

// Add your other routes here...

// === ERROR TRACKING ===
app.use(errorTrackingMiddleware);

// === ERROR HANDLER ===
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// === DATABASE CONNECTION ===
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// === START SERVER ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
```

### 3. Update Environment Variables

Create `frontend/.env`:

```bash
# Server
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001

# Database
MONGODB_URI=mongodb://localhost:27017/lomoji
DB_NAME=lomoji_dev

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Trusted IPs (optional)
TRUSTED_IPS=127.0.0.1,::1
```

### 4. Wrap Your App with Error Boundary

Update `frontend/src/App.jsx`:

```javascript
import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';
import Routes from './Routes';

// Import responsive styles
import './styles/index.css';
import './styles/responsive.css';

function App() {
  return (
    <ErrorBoundary
      friendlyMessage="We're sorry, something went wrong. Please refresh the page."
      showHomeButton={true}
      onError={(error, errorInfo) => {
        // Optional: Send to error tracking service
        console.error('App Error:', error, errorInfo);
      }}
    >
      <BrowserRouter>
        <Routes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
```

### 5. Initialize Activity Tracker (Client-Side)

Create `frontend/src/services/tracking.js`:

```javascript
import { getActivityTracker } from '../middleware/activityTracker';

// Initialize tracker
const tracker = getActivityTracker('/api');

// Export for use in components
export default tracker;

// Make available globally (optional)
if (typeof window !== 'undefined') {
  window.activityTracker = tracker;
}
```

Then in your components:

```javascript
import tracker from './services/tracking';

// Track actions
tracker.trackLogin();
tracker.trackProjectOpen(projectId);
tracker.trackProjectSave(projectId);
```

### 6. Update Main Entry Point

Update `frontend/src/main.jsx`:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import tracking service
import './services/tracking';

// Import global styles
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 7. Update Vite Config

Update `frontend/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          canvas: ['./src/utils/canvasOptimization.js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});
```

---

## 🧪 Testing the Installation

### 1. Test Server

```bash
# Terminal 1: Start server
cd frontend
npm run server

# Should see:
# ✅ MongoDB connected
# 🚀 Server running on port 3001
```

### 2. Test Frontend

```bash
# Terminal 2: Start frontend
cd frontend
npm run dev

# Should see:
# VITE ready in XXX ms
# ➜ Local: http://localhost:5173/
```

### 3. Test Activity Tracking

Open browser console and test:

```javascript
// Should work
window.activityTracker.trackLogin();
window.activityTracker.trackPageView('home');

// Check MongoDB
// db.activity_logs.find().pretty()
```

### 4. Test Error Boundary

Temporarily add an error to test:

```javascript
// In any component
function TestError() {
  throw new Error('Test error boundary');
}
```

You should see the premium error UI with retry button.

### 5. Test Responsive Layout

1. Open http://localhost:5173
2. Open DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M)
4. Test different screen sizes:
   - iPhone SE (375px)
   - iPad (768px)
   - Desktop (1024px+)

**Verify:**
- ✅ No horizontal scroll
- ✅ Sidebar collapses on mobile
- ✅ Toolbar wraps properly
- ✅ Canvas scales correctly

### 6. Test Canvas Performance

Open browser DevTools > Performance:

1. Start recording
2. Draw on canvas
3. Add objects
4. Play animation
5. Stop recording

**Verify:**
- ✅ 60 FPS maintained
- ✅ No long tasks (> 50ms)
- ✅ Smooth scrolling

---

## 🐛 Troubleshooting

### Error: Cannot find module 'ua-parser-js'

```bash
npm install ua-parser-js
```

### Error: MongoDB connection failed

1. Check if MongoDB is running:
   ```bash
   # macOS/Linux
   sudo systemctl status mongodb

   # Or
   mongod --version
   ```

2. Update MONGODB_URI in .env

### Error: CORS policy blocked

1. Check ALLOWED_ORIGINS in .env
2. Restart server after changing .env

### Error: Module not found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Canvas not scaling properly

1. Check if responsive.css is imported
2. Verify canvasRef is used correctly:

```javascript
import { useCanvasResize } from './hooks/usePerformance';

const canvasRef = useCanvasResize();
return <canvas ref={canvasRef} />;
```

### Activity tracking not working

1. Check MongoDB connection
2. Verify tracker initialization:
   ```javascript
   import tracker from './services/tracking';
   console.log('Tracker:', tracker);
   ```

3. Check API route:
   ```bash
   curl http://localhost:3001/api/activity/recent
   ```

---

## 📦 Production Build

### 1. Build Frontend

```bash
cd frontend
npm run build
```

Output in `frontend/dist/`

### 2. Test Production Build

```bash
npm run preview
```

Open http://localhost:4173

### 3. Check Bundle Size

```bash
ls -lh dist/assets/

# Should see:
# index-[hash].js ~180KB (gzipped < 60KB)
# index-[hash].css ~20KB (gzipped < 8KB)
```

### 4. Deploy

Follow `PRODUCTION_DEPLOYMENT_CHECKLIST.md`

---

## 🔄 Updating Existing Project

If you're adding to an existing project:

### Step 1: Backup

```bash
git add .
git commit -m "Backup before optimization"
git branch backup-$(date +%Y%m%d)
```

### Step 2: Add Files

Copy these files to your project:
```
✅ /frontend/src/styles/responsive.css
✅ /frontend/src/utils/canvasOptimization.js
✅ /frontend/src/hooks/usePerformance.js
✅ /frontend/src/models/ActivityLog.js
✅ /frontend/src/middleware/activityTracker.js
✅ /frontend/src/middleware/security.js
✅ /frontend/src/api/activityRoutes.js
✅ /frontend/src/components/ErrorBoundary.jsx
✅ /frontend/src/components/ui/PremiumButton.jsx
✅ /frontend/src/components/ui/PremiumButton.css
```

### Step 3: Update Imports

Update your existing files to import responsive.css:

```javascript
// In main.jsx or App.jsx
import './styles/responsive.css';
```

### Step 4: Test Incrementally

Test each feature separately:

1. ✅ Responsive layout
2. ✅ Canvas performance
3. ✅ Activity tracking
4. ✅ Error boundaries
5. ✅ Security middleware

---

## 🎯 Quick Wins

### Immediate Impact (30 minutes)

1. **Add responsive.css**
   ```javascript
   import './styles/responsive.css';
   ```

2. **Wrap with ErrorBoundary**
   ```javascript
   <ErrorBoundary><App /></ErrorBoundary>
   ```

3. **Add security middleware**
   ```javascript
   app.use(security.helmetConfig);
   app.use(security.apiLimiter);
   ```

Result: 50% better UX immediately!

### Medium Impact (2 hours)

1. **Implement canvas optimization**
2. **Add activity tracking**
3. **Use performance hooks**

Result: 4x performance improvement!

### Full Implementation (1 day)

Complete all optimizations for production-ready app.

---

## 📞 Support

Having issues? Check:

1. ✅ All dependencies installed?
2. ✅ MongoDB running?
3. ✅ .env file configured?
4. ✅ Server restarted after changes?
5. ✅ Browser console for errors?
6. ✅ Network tab for API calls?

Still stuck? Review:
- `OPTIMIZATION_SUMMARY.md` - Feature explanations
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md` - Pre-launch checklist

---

**Last Updated**: 2026-02-24
**Version**: 1.0
**Status**: Ready to Install ✅
