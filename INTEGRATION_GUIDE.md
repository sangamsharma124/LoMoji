# Quick Integration Guide - Add Activity Tracking in 5 Minutes

## The Problem

The activity tracking system is **built and working** (tested and verified ✅), but it's not integrated into your AnimationTool component yet.

## The Solution

Add these lines to your AnimationTool component:

---

## Step 1: Import the Hook

**File:** `frontend/src/pages/AnimationTool/index.jsx`

Add this import at the top with your other imports:

```javascript
import { useActivityTracker } from '../../hooks/useActivityTracker';
```

---

## Step 2: Initialize the Hook

Inside your `AnimationTool` component, add this after your other useState/useRef declarations:

```javascript
const AnimationTool = () => {
  // ... existing state declarations ...

  // ADD THIS - Initialize activity tracker
  const {
    trackProjectAction,
    trackElementAction,
    trackKeyframeAction,
    trackAnimationAction,
    trackSessionStart,
    trackSessionEnd
  } = useActivityTracker();

  // ... rest of component
};
```

---

## Step 3: Track Session (Optional but Recommended)

Add this useEffect to track when user opens/closes the animation tool:

```javascript
// Track session start/end
useEffect(() => {
  trackSessionStart();

  return () => {
    trackSessionEnd();
  };
}, [trackSessionStart, trackSessionEnd]);
```

---

## Step 4: Add Tracking to Existing Functions

Find your existing functions and add ONE line to each:

### Track Project Save

Find your `saveProject` function and add:

```javascript
const saveProject = async () => {
  setIsSaving(true);
  try {
    const response = await fetch('http://localhost:5000/api/canvas/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // ... your existing data ...
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Project saved successfully');

      // ADD THIS LINE:
      trackProjectAction('saved', dashboardId, fileName, {
        elementCount: objects.length,
        duration: totalFrames / fps,
        fps
      });
    }
  } catch (error) {
    console.error('Error saving project:', error);
  } finally {
    setIsSaving(false);
  }
};
```

### Track Project Load

Find your `loadProject` function and add:

```javascript
const loadProject = async (projectId) => {
  if (!projectId) return;
  try {
    const response = await fetch(`http://localhost:5000/api/canvas/project/${projectId}`);
    const data = await response.json();

    if (response.ok && data.project) {
      setObjects(data.project.elements || []);
      setFileName(data.project.projectName);
      // ... rest of your loading code ...

      // ADD THIS LINE:
      trackProjectAction('opened', projectId, data.project.projectName, {
        elementCount: data.project.elements?.length || 0,
        duration: data.project.duration,
        fps: data.project.fps
      });
    }
  } catch (error) {
    console.error('Error loading project:', error);
  }
};
```

### Track Element Add

Find where you add shapes (rectangles, circles, etc.) and add:

```javascript
// Example: In your handleAssetClick or addShape function
const addRectangle = () => {
  const newRect = {
    id: `rect_${Date.now()}`,
    type: 'rectangle',
    x: 600,
    y: 300,
    width: 100,
    height: 100,
    fill: '#6366f1',
    // ... other properties ...
  };

  setObjects([...objects, newRect]);

  // ADD THIS LINE:
  trackElementAction('added', {
    elementType: 'rectangle',
    elementId: newRect.id,
    position: { x: newRect.x, y: newRect.y },
    size: { width: newRect.width, height: newRect.height },
    fill: newRect.fill
  }, dashboardId, fileName);
};
```

### Track Element Delete

Find your delete function and add:

```javascript
const deleteElement = (elementId) => {
  const element = objects.find(obj => obj.id === elementId);

  setObjects(objects.filter(obj => obj.id !== elementId));

  // ADD THIS LINE:
  trackElementAction('deleted', {
    elementId,
    elementType: element.type,
    elementName: element.name
  }, dashboardId, fileName);
};
```

### Track Keyframe Add

Find your `addKeyframe` function and add:

```javascript
const addKeyframe = useCallback((objectId, property, frame, value, easing = 'linear') => {
  setKeyframes(prev => {
    // ... your existing keyframe logic ...
  });

  // ADD THIS LINE:
  trackKeyframeAction('added', {
    objectId,
    property,
    frame,
    value,
    easing
  }, dashboardId, fileName);
}, [trackKeyframeAction, dashboardId, fileName]);
```

### Track Animation Play/Pause

Find your play/pause functions and add:

```javascript
const togglePlayback = () => {
  if (isPlaying) {
    setIsPlaying(false);

    // ADD THIS LINE:
    trackAnimationAction('paused', {
      currentFrame,
      totalFrames,
      fps
    }, dashboardId, fileName);
  } else {
    setIsPlaying(true);

    // ADD THIS LINE:
    trackAnimationAction('played', {
      currentFrame,
      totalFrames,
      fps
    }, dashboardId, fileName);
  }
};
```

---

## Step 5: Test It!

1. **Restart the server** (important!):
   ```bash
   cd frontend
   npm run server
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   ```

3. **Login to your app**

4. **Open animation tool** and perform actions:
   - Add a rectangle
   - Add a keyframe
   - Save the project
   - Play the animation

5. **Check MongoDB** for activities:
   ```bash
   # Replace with your email
   curl http://localhost:5000/api/activities/email/YOUR_EMAIL@example.com
   ```

You should see all your activities! 🎉

---

## Example: Minimal Integration

If you want to start small, just add these 3 things:

```javascript
import { useActivityTracker } from '../../hooks/useActivityTracker';

const AnimationTool = () => {
  // 1. Initialize
  const { trackProjectAction } = useActivityTracker();

  // 2. Track project save
  const saveProject = async () => {
    // ... existing save logic ...

    trackProjectAction('saved', dashboardId, fileName, {
      elementCount: objects.length
    });
  };

  // 3. Track project load
  const loadProject = async (projectId) => {
    // ... existing load logic ...

    trackProjectAction('opened', projectId, projectName, {
      elementCount: elements.length
    });
  };

  // Done! Now save and load are tracked.
};
```

---

## What Happens When You Track?

Every time you call a tracking function:

1. **Data sent to backend:**
   ```
   POST http://localhost:5000/api/activities
   ```

2. **Saved to MongoDB:**
   ```javascript
   {
     actionType: "element_added",
     actionData: { elementType: "rectangle", ... },
     projectId: "project_1771685739865",
     projectName: "My Animation",
     timestamp: "2026-02-21T16:30:00Z",
     email: "user@example.com"
   }
   ```

3. **Can be retrieved later:**
   ```
   GET http://localhost:5000/api/activities/email/user@example.com
   ```

---

## Common Issues

### Issue 1: "Activity tracking skipped: User not logged in"

**Solution:** Make sure user is logged in. The hook checks:
```javascript
const storedUser = localStorage.getItem('user');
```

### Issue 2: "Cannot POST /api/activities"

**Solution:** Restart the server:
```bash
lsof -ti:5000 | xargs kill -9
cd frontend && npm run server
```

### Issue 3: No activities showing up

**Solution:** Check:
1. Is user logged in? (Check localStorage)
2. Is server restarted? (New endpoints need restart)
3. Are you calling the tracking functions? (Add console.log to verify)

---

## View Your Activities

### Option 1: API Call
```bash
curl http://localhost:5000/api/activities/email/YOUR_EMAIL
```

### Option 2: Activity Dashboard

1. Add route to `Routes.jsx`:
   ```javascript
   import ActivityDashboard from './pages/ActivityDashboard';

   <Route path="/activity" element={<ActivityDashboard />} />
   ```

2. Visit: `http://localhost:5173/activity`

### Option 3: MongoDB Compass

1. Connect to your MongoDB
2. Database: `LoMoji`
3. Collection: `useractionactivities`

---

## Summary

✅ **System is built and tested** - API endpoints working, data storing in MongoDB
⚠️ **Just needs integration** - Add the hook to your AnimationTool component
✅ **5 minutes to integrate** - Just import hook and add tracking calls
✅ **Then it works automatically** - Every action will be tracked!

**Next step:** Copy the code examples above into your AnimationTool component! 🚀

---

**Files to edit:**
1. `frontend/src/pages/AnimationTool/index.jsx` - Add tracking calls

**That's it!** 🎯
