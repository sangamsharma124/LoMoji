import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { User, createUserActivityModel, UserFileActivity, GmailData, UserSession, UserFile, CanvasProject, UserActionActivity } from './src/models/index.js';

const app = express();
app.use(express.json());
app.use(cors());

// --- User DB connection ---
let userMongoConnected = false;
const userDbUri = process.env.MONGODB_URI || 'mongodb+srv://sangsharma124:demo1234@lomoji.y5egnd9.mongodb.net/LoMoji?retryWrites=true&w=majority';

mongoose.connection.on('connected', () => {
  userMongoConnected = true;
  console.log('✅ User DB: Mongo connected');
});
mongoose.connection.on('error', (err) => {
  userMongoConnected = false;
  console.log('⚠️ User DB: Mongo connection failed:', err.message);
});

mongoose.connect(userDbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

// --- User Activity DB connection ---
let activityMongoConnected = false;
const activityDbUri = process.env.MONGODB_ACTIVITY_URI || 'mongodb+srv://LoMojiUser_Activity:sangam902929@lomojiuseractivity.ul0qmry.mongodb.net/LoMojiUserActivity?retryWrites=true&w=majority';

const userActivityConn = mongoose.createConnection(activityDbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

userActivityConn.on('connected', () => {
  activityMongoConnected = true;
  console.log('✅ User Activity DB: Mongo connected');
});
userActivityConn.on('error', (err) => {
  activityMongoConnected = false;
  console.log('⚠️ User Activity DB: Mongo connection failed:', err.message);
});

// Create UserActivity model with the specific connection
const UserActivity = createUserActivityModel(userActivityConn);

// --- Schemas and Models ---
// Models are now imported from src/models/

// JWT secret and expiry
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_EXPIRES_IN = '2m';

// Middleware to validate JWT
function authenticateToken(req, res, next) {
  // Try to get token from cookie or Authorization header
  let token = null;
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  });
}

// --- Health check endpoint ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running!',
    userMongoConnected,
    activityMongoConnected
  });
});

// Signup endpoint
app.post('/api/users', async (req, res) => {
  const { fullName, email, password } = req.body;
  const user = { fullName, email, password };
  
  try {
    if (userMongoConnected) {
      const dbUser = new User(user);
      await dbUser.save();
      return res.status(201).json({ message: 'User saved to MongoDB successfully!' });
    } else {
      return res.status(503).json({ error: 'MongoDB not connected. Cannot save user.' });
    }
  } catch (err) {
    console.log('Error saving user:', err.message);
    return res.status(500).json({ error: 'Error saving user', details: err.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (userMongoConnected) {
      const user = await User.findOne({ email, password });
      if (user) {
        // Generate JWT
        const payload = { id: user._id, email: user.email, name: user.fullName };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Set HTTP-only cookie
        res.cookie('token', token, { httpOnly: true, maxAge: 2 * 60 * 1000 });
        // Record session start in UserSession
        let userSession = await UserSession.findOne({ email: user.email });
        if (!userSession) {
          userSession = new UserSession({ email: user.email, sessions: [] });
        }
        userSession.sessions.push({ startTime: new Date(), active: true });
        await userSession.save();
        // Return token in response for localStorage fallback
        return res.json({ success: true, user: payload, token });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      return res.status(503).json({ success: false, message: 'MongoDB not connected' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error during login', details: err.message });
  }
});

// Logout endpoint to record session end
app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const userSession = await UserSession.findOne({ email });
    if (userSession && userSession.sessions.length > 0) {
      // Find the latest active session
      const latestSession = userSession.sessions.reverse().find(s => s.active);
      if (latestSession) {
        latestSession.endTime = new Date();
        latestSession.active = false;
        await userSession.save();
      }
    }
    res.clearCookie('token');
    return res.json({ success: true, message: 'Session ended and recorded.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error during logout', details: err.message });
  }
});

// Store Gmail data endpoint
app.post('/api/gmail-data', async (req, res) => {
  const { userId, gmailMessages } = req.body;
  
  try {
    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const savedMessages = [];
    
    for (const message of gmailMessages) {
      const gmailData = new GmailData({
        userId: userId,
        emailId: message.id,
        subject: message.payload?.headers?.find(h => h.name === 'Subject')?.value || '',
        sender: message.payload?.headers?.find(h => h.name === 'From')?.value || '',
        recipient: message.payload?.headers?.find(h => h.name === 'To')?.value || '',
        body: message.snippet || '',
        threadId: message.threadId,
        messageId: message.id,
        dateReceived: new Date(parseInt(message.internalDate)),
        gmailData: message // Store complete Gmail API response
      });
      
      await gmailData.save();
      savedMessages.push(gmailData);
    }

    return res.status(201).json({ 
      message: `Successfully stored ${savedMessages.length} Gmail messages`,
      count: savedMessages.length 
    });
    
  } catch (err) {
    console.log('Error saving Gmail data:', err.message);
    return res.status(500).json({ error: 'Error saving Gmail data', details: err.message });
  }
});

// Get Gmail data for user
app.get('/api/gmail-data/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const gmailData = await GmailData.find({ userId }).sort({ dateReceived: -1 });
    return res.json({ gmailData });
    
  } catch (err) {
    console.log('Error fetching Gmail data:', err.message);
    return res.status(500).json({ error: 'Error fetching Gmail data', details: err.message });
  }
});

// --- Admin: Get all users ---
app.get('/api/admin/users', async (req, res) => {
  try {
    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    const users = await User.find({}, { password: 0 }); // Exclude password
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching users', details: err.message });
  }
});

// --- Admin: Get user by ID ---
app.get('/api/admin/users/:id', async (req, res) => {
  try {
    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    const user = await User.findById(req.params.id, { password: 0 });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching user', details: err.message });
  }
});

// --- Admin: Get user session logs ---
app.get('/api/admin/users/:id/sessions', async (req, res) => {
  try {
    if (!activityMongoConnected) {
      return res.status(503).json({ error: 'User Activity DB not connected' });
    }
    const sessions = await UserActivity.find({ userId: req.params.id }).sort({ timestamp: -1 });
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching sessions', details: err.message });
  }
});

// --- Admin: Get user session manager data (sessions array) ---
app.get('/api/admin/users/:id/session-manager', async (req, res) => {
  try {
    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    // Find user by ID to get email
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userSession = await UserSession.findOne({ email: user.email });
    return res.json({ sessions: userSession ? userSession.sessions : [] });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching session manager data', details: err.message });
  }
});

// --- API: Record a session activity (login/logout) and update active status ---
app.post('/api/admin/users/:id/sessions', async (req, res) => {
  try {
    if (!activityMongoConnected) {
      return res.status(503).json({ error: 'User Activity DB not connected' });
    }
    const { activity } = req.body;
    const userId = req.params.id;
    if (!activity || !['login', 'logout'].includes(activity)) {
      return res.status(400).json({ error: 'activity must be login or logout' });
    }
    let session;
    if (activity === 'login') {
      session = new UserActivity({ userId, activity: 'login', active: true });
      await session.save();
    } else if (activity === 'logout') {
      // Find the latest active login session and mark it as closed
      const latestLogin = await UserActivity.findOne({ userId, activity: 'login', active: true }).sort({ timestamp: -1 });
      if (latestLogin) {
        latestLogin.active = false;
        await latestLogin.save();
      }
      session = new UserActivity({ userId, activity: 'logout', active: false });
      await session.save();
    }
    return res.status(201).json({ message: 'Session activity recorded', session });
  } catch (err) {
    return res.status(500).json({ error: 'Error recording session activity', details: err.message });
  }
});

// --- API: Save a user file activity ---
app.post('/api/user/:id/activity', async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    let userId = req.params.id;
    console.log('[User Activity] Incoming:', { userId, fileName, fileType });
    if (!fileName || !fileType) {
      console.log('[User Activity] Missing fileName or fileType');
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }
    if (!userMongoConnected) {
      console.log('[User Activity] Activity DB not connected');
      return res.status(503).json({ error: 'User Activity DB not connected' });
    }
    // If userId is not a valid ObjectId, try to look up by email
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      // Try to find user by email
      const user = await User.findOne({ email: userId });
      if (user) {
        userId = user._id;
        console.log('[User Activity] Found user by email:', user.email, userId);
      } else {
        console.log('[User Activity] No user found by email, using email as userId');
      }
    }
    const activity = new UserFileActivity({ userId, fileName, fileType });
    console.log('[User Activity] Saving activity:', activity);
    await activity.save();
    console.log('[User Activity] Activity saved successfully');
    return res.status(201).json({ message: 'Activity saved', activity });
  } catch (err) {
    console.error('[User Activity] Error saving activity:', err);
    return res.status(500).json({ error: 'Error saving activity', details: err.message });
  }
});

// --- API: Get all user file activities for a user ---
app.get('/api/user/:id/activity', async (req, res) => {
  try {
    const userId = req.params.id;
    const activities = await UserFileActivity.find({ userId }).sort({ createdAt: -1 });
    return res.json({ activities });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching activities', details: err.message });
  }
});

// --- API: Save a user file (by email) ---
app.post('/api/user/:email/file', async (req, res) => {
  try {
    const { fileName, fileType, content } = req.body;
    const email = req.params.email;
    if (!fileName || !fileType || !email) {
      return res.status(400).json({ error: 'fileName, fileType, and email are required' });
    }
    // Check for duplicate file name for this user
    const existing = await UserFile.findOne({ email, fileName });
    if (existing) {
      return res.status(409).json({ error: `${fileName} already exists!` });
    }
    const file = new UserFile({ email, fileName, fileType, content: content || [] });
    await file.save();
    return res.status(201).json({ message: 'File saved', file });
  } catch (err) {
    return res.status(500).json({ error: 'Error saving file', details: err.message });
  }
});

// --- API: Update a user file (by ID) ---
app.put('/api/file/:id', async (req, res) => {
  try {
    const { content, fileName, fileType } = req.body;
    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (fileName !== undefined) updateData.fileName = fileName;
    if (fileType !== undefined) updateData.fileType = fileType;

    const file = await UserFile.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.json({ message: 'File updated', file });
  } catch (err) {
    return res.status(500).json({ error: 'Error updating file', details: err.message });
  }
});

// --- API: Get a single user file (by ID) ---
app.get('/api/file/:id', async (req, res) => {
  try {
    const file = await UserFile.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.json({ file });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching file', details: err.message });
  }
});

// --- API: Get all user files (by email) ---
app.get('/api/user/:email/files', async (req, res) => {
  try {
    const email = req.params.email;
    const files = await UserFile.find({ email }).sort({ createdAt: -1 });
    return res.json({ files });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching files', details: err.message });
  }
});

// --- API: Delete a user file (by email and fileName) ---
app.delete('/api/user/:email/file', async (req, res) => {
  try {
    const email = req.params.email;
    const { fileName } = req.body;
    if (!email || !fileName) {
      return res.status(400).json({ error: 'email and fileName are required' });
    }
    const result = await UserFile.deleteOne({ email, fileName });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.json({ message: 'File deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Error deleting file', details: err.message });
  }
});

// ========================================
// CANVAS PROJECT ENDPOINTS
// ========================================

// --- API: Save a canvas project ---
app.post('/api/canvas/project', async (req, res) => {
  try {
    const {
      userId,
      email,
      projectName,
      projectId,
      canvasWidth,
      canvasHeight,
      backgroundColor,
      elements,
      duration,
      fps,
      currentFrame,
      loop,
      autoKey,
      thumbnail
    } = req.body;

    if (!userId || !email || !projectName || !projectId) {
      return res.status(400).json({ error: 'userId, email, projectName, and projectId are required' });
    }

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    // Check if project already exists
    let project = await CanvasProject.findOne({ projectId });

    if (project) {
      // Update existing project
      project.projectName = projectName;
      project.canvasWidth = canvasWidth || 800;
      project.canvasHeight = canvasHeight || 600;
      project.backgroundColor = backgroundColor || '#ffffff';
      project.elements = elements || [];
      project.duration = duration || 10;
      project.fps = fps || 30;
      project.currentFrame = currentFrame || 0;
      project.loop = loop || false;
      project.autoKey = autoKey || false;
      project.thumbnail = thumbnail;
      await project.save();
      return res.json({ message: 'Project updated successfully', project });
    } else {
      // Create new project
      project = new CanvasProject({
        userId,
        email,
        projectName,
        projectId,
        canvasWidth: canvasWidth || 800,
        canvasHeight: canvasHeight || 600,
        backgroundColor: backgroundColor || '#ffffff',
        elements: elements || [],
        duration: duration || 10,
        fps: fps || 30,
        currentFrame: currentFrame || 0,
        loop: loop || false,
        autoKey: autoKey || false,
        thumbnail
      });
      await project.save();
      return res.status(201).json({ message: 'Project saved successfully', project });
    }
  } catch (err) {
    console.error('Error saving canvas project:', err);
    return res.status(500).json({ error: 'Error saving canvas project', details: err.message });
  }
});

// --- API: Get a canvas project by projectId ---
app.get('/api/canvas/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const project = await CanvasProject.findOne({ projectId });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project });
  } catch (err) {
    console.error('Error fetching canvas project:', err);
    return res.status(500).json({ error: 'Error fetching canvas project', details: err.message });
  }
});

// --- API: Get all projects for a user (by email) ---
app.get('/api/canvas/projects/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const projects = await CanvasProject.find({ email }).sort({ lastModified: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error('Error fetching canvas projects:', err);
    return res.status(500).json({ error: 'Error fetching canvas projects', details: err.message });
  }
});

// --- API: Delete a canvas project ---
app.delete('/api/canvas/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const result = await CanvasProject.deleteOne({ projectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting canvas project:', err);
    return res.status(500).json({ error: 'Error deleting canvas project', details: err.message });
  }
});

// ========================================
// USER ACTIVITY TRACKING ENDPOINTS
// ========================================

// --- API: Log a user activity ---
app.post('/api/activities', async (req, res) => {
  try {
    const {
      userId,
      email,
      actionType,
      actionData,
      projectId,
      projectName,
      sessionId,
      userAgent,
      browser,
      device,
      platform
    } = req.body;

    if (!userId || !email || !actionType) {
      return res.status(400).json({ error: 'userId, email, and actionType are required' });
    }

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const activity = new UserActionActivity({
      userId,
      email,
      actionType,
      actionData: actionData || {},
      projectId,
      projectName,
      sessionId,
      userAgent,
      browser,
      device,
      platform,
      timestamp: new Date()
    });

    await activity.save();
    return res.status(201).json({ message: 'Activity logged successfully', activity });
  } catch (err) {
    console.error('Error logging activity:', err);
    return res.status(500).json({ error: 'Error logging activity', details: err.message });
  }
});

// --- API: Get user activity timeline ---
app.get('/api/activities/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const activities = await UserActionActivity.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.json({ activities, count: activities.length });
  } catch (err) {
    console.error('Error fetching user activities:', err);
    return res.status(500).json({ error: 'Error fetching activities', details: err.message });
  }
});

// --- API: Get activities by email ---
app.get('/api/activities/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const activities = await UserActionActivity.find({ email })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.json({ activities, count: activities.length });
  } catch (err) {
    console.error('Error fetching user activities:', err);
    return res.status(500).json({ error: 'Error fetching activities', details: err.message });
  }
});

// --- API: Get project activity timeline ---
app.get('/api/activities/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const activities = await UserActionActivity.find({ projectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.json({ activities, count: activities.length });
  } catch (err) {
    console.error('Error fetching project activities:', err);
    return res.status(500).json({ error: 'Error fetching activities', details: err.message });
  }
});

// --- API: Get session activities ---
app.get('/api/activities/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const activities = await UserActionActivity.find({ sessionId })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ activities, count: activities.length });
  } catch (err) {
    console.error('Error fetching session activities:', err);
    return res.status(500).json({ error: 'Error fetching activities', details: err.message });
  }
});

// --- API: Get activity stats ---
app.get('/api/activities/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userMongoConnected) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }

    const stats = await UserActionActivity.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 },
          lastOccurred: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalActions = await UserActionActivity.countDocuments({ userId });

    return res.json({
      totalActions,
      actionBreakdown: stats
    });
  } catch (err) {
    console.error('Error fetching activity stats:', err);
    return res.status(500).json({ error: 'Error fetching stats', details: err.message });
  }
});

// --- Protect admin and user data routes with JWT middleware ---
app.use(['/api/admin', '/api/gmail-data', '/api/admin/users/:id/sessions', '/api/admin/users/:id/activities'], authenticateToken);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 MongoDB Status: ${userMongoConnected ? 'Connected' : 'Not Connected'}`);
});