const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const { initSchema } = require('./models/schemaInit');
const { corsOptions, securityHeaders } = require('./middleware/security');
const { getEnv } = require('./config/env');
const { uploadDir } = require('./config/paths');

const app = express();

app.use(cors(corsOptions()));
app.use(securityHeaders);
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

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

const sseRoutes = require('./routes/sse');
app.use('/api', sseRoutes);

const PORT = Number(getEnv('PORT', '5000'));

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
