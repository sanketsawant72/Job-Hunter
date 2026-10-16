/**
 * Client-side validation utilities
 */

export const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

export const isValidUrl = (url) => {
  try { new URL(url); return true; } catch { return false; }
};

export const isStrongPassword = (password) => password && password.length >= 6;

export const isValidFileType = (file, allowed = ['.pdf', '.docx']) => {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return allowed.includes(ext);
};

export const isUnderSizeLimit = (file, maxMB = 5) => file.size <= maxMB * 1024 * 1024;
