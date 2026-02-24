# How to Use LoMoji Project Storage System
## Like Lottielab - Store and Share Animation Projects

---

## Quick Start

Your LoMoji app already has a complete project storage system! Here's how to use it:

### 1. Create a New Project

**Option A: From Dashboard**
1. Go to `/projects`
2. Click **"+ New Project"**
3. You'll be redirected to `/animation-tool/project_[unique-id]`

**Option B: Direct URL**
1. Go to `/animation-tool`
2. A new project will be created when you save

### 2. Work on Your Animation

- Add shapes, emojis, text, etc.
- Create animations with keyframes
- Adjust properties in the Properties panel

### 3. Save Your Project

Click the **"Save"** button in the top toolbar

**What happens:**
- Your project is saved to MongoDB
- The URL updates to include your project ID
- Example: `/animation-tool/project_1771685739865`
- A thumbnail is generated

### 4. View All Your Projects

Go to `/projects` to see all your saved projects in a grid view

**Each project shows:**
- Thumbnail preview
- Project name
- Last modified date
- Element count, duration, FPS
- "Open" and "Delete" buttons

### 5. Open an Existing Project

**Option A: From Dashboard**
1. Go to `/projects`
2. Click **"Open"** on any project card

**Option B: Direct URL**
1. Copy the project URL
2. Example: `http://localhost:5173/animation-tool/project_1771685739865`
3. Paste in browser
4. Project loads automatically

### 6. Share Your Project

Simply share the URL with anyone:
```
https://lomoji.com/animation-tool/project_1771685739865
```

Anyone with the URL can view/edit the project (add permissions later if needed)

---

## URL Structure

Your project URLs follow this pattern:

```
https://lomoji.com/animation-tool/[project-id]
                                    └─ Unique identifier
```

**Example:**
```
https://lomoji.com/animation-tool/project_1771685739865
```

This is similar to Lottielab:
```
https://lottielab.com/editor?project=abc-123
```

---

## What Gets Saved?

When you save a project, **everything** is stored in MongoDB:

### Project Information
- ✅ Project name
- ✅ Unique project ID
- ✅ Creation and modification dates
- ✅ User email and ID
- ✅ Thumbnail image

### Canvas Settings
- ✅ Canvas width and height
- ✅ Background color
- ✅ Zoom level

### All Elements
- ✅ Shapes (rectangles, circles, triangles, etc.)
- ✅ Emojis
- ✅ Text layers
- ✅ Images
- ✅ Drawings (pencil, brush strokes)

### Element Properties
- ✅ Position (x, y)
- ✅ Size (width, height)
- ✅ Rotation
- ✅ Opacity
- ✅ Fill color
- ✅ Stroke color and width
- ✅ Visibility and lock status
- ✅ Layer name

### Animation Data
- ✅ All keyframes
- ✅ Animation duration
- ✅ FPS (frames per second)
- ✅ Current frame position
- ✅ Loop setting
- ✅ Auto-key setting

---

## API Endpoints (For Developers)

### Save/Update Project
```javascript
POST /api/canvas/project

// Request body
{
  "userId": "user-id",
  "email": "user@example.com",
  "projectName": "My Animation",
  "projectId": "project_1771685739865",
  "elements": [...],
  "duration": 10,
  "fps": 30,
  // ... other settings
}

// Response
{
  "message": "Project saved successfully",
  "project": { /* full project data */ }
}
```

### Load Project
```javascript
GET /api/canvas/project/:projectId

// Example
GET /api/canvas/project/project_1771685739865

// Response
{
  "project": { /* full project data */ }
}
```

### Get All User Projects
```javascript
GET /api/canvas/projects/:email

// Example
GET /api/canvas/projects/user@example.com

// Response
{
  "projects": [
    { /* project 1 */ },
    { /* project 2 */ },
    // ...
  ]
}
```

### Delete Project
```javascript
DELETE /api/canvas/project/:projectId

// Example
DELETE /api/canvas/project/project_1771685739865

// Response
{
  "message": "Project deleted successfully"
}
```

---

## Using in Your Code

### Frontend Integration

The AnimationTool component automatically handles project loading:

```javascript
import { useParams } from 'react-router-dom';

const AnimationTool = () => {
  const { dashboardId } = useParams(); // Gets project ID from URL

  useEffect(() => {
    if (dashboardId) {
      loadProject(dashboardId); // Loads project from MongoDB
    }
  }, [dashboardId]);

  // ... rest of component
};
```

### Save Function
```javascript
const saveProject = async () => {
  const projectData = {
    userId,
    email: userEmail,
    projectName: fileName,
    projectId: dashboardId || `project_${Date.now()}`,
    elements: objects,
    duration: totalFrames / fps,
    fps,
    currentFrame,
    loop: loopEnabled,
    autoKey: autoKeying,
  };

  const response = await fetch('http://localhost:5000/api/canvas/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData)
  });

  // Update URL with project ID
  if (!dashboardId) {
    window.history.pushState({}, '', `/animation-tool/${data.project.projectId}`);
  }
};
```

### Load Function
```javascript
const loadProject = async (projectId) => {
  const response = await fetch(`http://localhost:5000/api/canvas/project/${projectId}`);
  const data = await response.json();

  if (response.ok && data.project) {
    setObjects(data.project.elements);
    setFileName(data.project.projectName);
    setCurrentFrame(data.project.currentFrame);
    setFps(data.project.fps);
    // ... restore other settings
  }
};
```

---

## Environment Setup

Make sure your `.env` file has MongoDB credentials:

```env
# MongoDB Connection URI
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/LoMoji?retryWrites=true&w=majority

# Server Configuration
PORT=5000

# JWT Secret
JWT_SECRET=your_secret_key_here
```

---

## Testing Your Setup

### Manual Test

1. **Start the servers:**
   ```bash
   cd frontend
   npm run server  # Terminal 1
   npm run dev     # Terminal 2
   ```

2. **Test the workflow:**
   - Go to `http://localhost:5173/projects`
   - Click "+ New Project"
   - Add a rectangle to the canvas
   - Click "Save"
   - Check that URL changed to `/animation-tool/project_[id]`
   - Refresh the page
   - Verify rectangle is still there
   - Go back to `/projects`
   - Verify your project appears in the grid

### API Test with curl

```bash
# Check server health
curl http://localhost:5000/api/health

# Create a test project
curl -X POST http://localhost:5000/api/canvas/project \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test123",
    "email": "test@example.com",
    "projectName": "Test Project",
    "projectId": "project_test",
    "elements": [],
    "duration": 10,
    "fps": 30
  }'

# Load the project
curl http://localhost:5000/api/canvas/project/project_test

# Get all projects for user
curl http://localhost:5000/api/canvas/projects/test@example.com

# Delete the project
curl -X DELETE http://localhost:5000/api/canvas/project/project_test
```

---

## Troubleshooting

### Project not saving
- **Check:** Is the backend server running? (`npm run server`)
- **Check:** Is MongoDB connected? (Look for "✅ User DB: Mongo connected" in server logs)
- **Check:** Browser console for errors (F12 → Console)

### Project not loading
- **Check:** Is the project ID correct in the URL?
- **Check:** Does the project exist in MongoDB?
- **Check:** Network tab (F12 → Network) for failed requests

### Dashboard not showing projects
- **Check:** Is user logged in? (User email should be in localStorage)
- **Check:** Does the user have any projects in MongoDB?
- **Check:** API endpoint `/api/canvas/projects/:email` returns data

### URL not updating on save
- **Check:** Is `window.history.pushState` working?
- **Check:** Browser console for JavaScript errors

---

## Best Practices

1. **Save frequently** - Click save after making significant changes
2. **Use descriptive names** - Rename "Untitled Animation" to something meaningful
3. **Check the URL** - Make sure URL has a project ID after saving
4. **Bookmark projects** - Save important project URLs
5. **Test loading** - After saving, refresh to verify data persists

---

## Next Steps (Optional Enhancements)

Your system is complete, but you could add:

1. **Auto-save** - Save every 30 seconds automatically
2. **Version history** - Keep track of project versions
3. **Duplicate project** - Clone existing projects
4. **Search/filter** - Search projects by name
5. **Folders** - Organize projects into folders
6. **Export** - Export to JSON, MP4, GIF
7. **Collaboration** - Multiple users editing same project
8. **Permissions** - Public/private projects
9. **Templates** - Pre-built animation templates
10. **Cloud backup** - Additional backup system

---

## Support

If you have questions or issues:

1. Check [PROJECT_STORAGE_SYSTEM.md](PROJECT_STORAGE_SYSTEM.md) for detailed docs
2. Check [TEST_REPORT.md](TEST_REPORT.md) for test results
3. Review server logs for errors
4. Check MongoDB database directly

---
