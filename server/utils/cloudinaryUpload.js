const cloudinary = require('../config/cloudinary');
const fs = require('fs');

async function uploadFileToCloudinary(filePath, folder, resourceType = 'auto') {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
    });

    // Delete the temporary local file after successful upload
    fs.unlinkSync(filePath);

    return result.secure_url;
  } catch (error) {
    // Delete the temporary file even if upload fails
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    throw error;
  }
}

module.exports = {
  uploadFileToCloudinary,
};