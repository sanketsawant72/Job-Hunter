const path = require('path');

const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, '../uploads')
);

const getResumePath = (resume) => {
  const filename = resume?.filename || (resume?.path && path.basename(resume.path));
  return filename ? path.join(uploadsDir, 'resume', path.basename(filename)) : null;
};

module.exports = { uploadsDir, getResumePath };
