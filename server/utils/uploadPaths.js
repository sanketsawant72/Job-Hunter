const path = require('path');
const fs   = require('fs');

const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, '../uploads')
);

/**
 * Resolve the absolute path of a resume file.
 *
 * Resolution order (stops at the first path that actually exists on disk):
 *   1. <uploadsDir>/resume/<filename>    — canonical computed path
 *   2. resume.path                       — absolute path stored at upload time
 *   3. <uploadsDir>/resume/<basename(resume.path)> — stored path re-anchored to uploadsDir
 *
 * This makes the lookup self-healing: if the server is moved, the volume
 * remounted, or a previous upload partially failed, the function falls back
 * gracefully instead of returning a non-existent path.
 */
const getResumePath = (resume) => {
  if (!resume) return null;

  const filename = resume.filename || (resume.path && path.basename(resume.path));
  if (!filename) return null;

  // 1. Canonical path
  const canonical = path.join(uploadsDir, 'resume', path.basename(filename));
  if (fs.existsSync(canonical)) return canonical;

  // 2. Stored absolute path (set by multer at upload time)
  if (resume.path && fs.existsSync(resume.path)) return resume.path;

  // 3. Stored path re-anchored to the current uploadsDir (handles server moves)
  if (resume.path) {
    const reanchored = path.join(uploadsDir, 'resume', path.basename(resume.path));
    if (fs.existsSync(reanchored)) return reanchored;
  }

  // Return the canonical path anyway so callers get a meaningful string for logs
  return canonical;
};

module.exports = { uploadsDir, getResumePath };
