const path = require('path');
const { getEnv } = require('./env');

const serverRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(serverRoot, '..');
const uploadDir = path.resolve(serverRoot, getEnv('UPLOAD_DIR', 'uploads'));

module.exports = {
  projectRoot,
  serverRoot,
  uploadDir
};
