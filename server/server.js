const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const { initSchema } = require('./models/schemaInit');
const { corsOptions, securityHeaders } = require('./middleware/security');

dotenv.config();
const app = express();

app.use(cors(corsOptions()));
app.use(securityHeaders);
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);

const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);

const taskRoutes = require('./routes/tasks');
app.use('/api/tasks', taskRoutes);

const searchRoutes = require('./routes/search');
app.use('/api/search', searchRoutes);

const dmRoutes = require('./routes/dm');
app.use('/api/dm', dmRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initSchema();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to initialize schema:', err.message);
    process.exit(1);
  }
}

startServer();
