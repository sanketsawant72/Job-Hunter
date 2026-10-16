/**
 * Formatting utility functions
 */
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

/**
 * Smart date format: "Today", "Yesterday", or "Jan 5"
 */
export const smartDate = (date) => {
  const d = new Date(date);
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, yyyy');
};

/**
 * Relative time: "2 hours ago"
 */
export const relativeTime = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

/**
 * File size formatting
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Truncate text
 */
export const truncate = (text, max = 80) => {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
};

/**
 * Status label → display text
 */
export const statusLabel = (status) => ({
  new: 'New',
  drafted: 'Drafted',
  sent: 'Sent',
  replied: 'Replied',
  rejected: 'Rejected',
  failed: 'Failed',
  approved: 'Approved',
  draft: 'Draft'
}[status] || status);

/**
 * Count words in a string
 */
export const wordCount = (text) => (text || '').split(/\s+/).filter(Boolean).length;
