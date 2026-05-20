// Shared file-upload validation used by every place the client lets a
// user attach a file (logo, expense receipt, invoice import). Centralized
// so the allowed types + size cap are defined once and can't drift.

export const ALLOWED_UPLOAD_MIMES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export const ALLOWED_UPLOAD_LABEL = 'JPG, PNG, HEIC, or PDF';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// `accept` attribute string for <input type="file">. The MIME list is
// authoritative on the JS side; this just hints the OS file picker.
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.heic,.heif,.pdf,image/jpeg,image/png,image/heic,image/heif,application/pdf';

// Validates a File. Returns null if OK, or a user-readable error string.
// Pass `{ images: true }` to reject PDFs (used by the logo + receipt
// upload UIs where a PDF wouldn't render correctly).
export function validateUpload(file, { images = false } = {}) {
  if (!file) return 'No file selected.';
  const type = (file.type || '').toLowerCase();
  const allowed = images
    ? ALLOWED_UPLOAD_MIMES.filter(m => m.startsWith('image/'))
    : ALLOWED_UPLOAD_MIMES;
  if (!allowed.includes(type)) {
    return images
      ? `Use a JPG, PNG, or HEIC image (saw "${file.type || 'unknown'}").`
      : `Use ${ALLOWED_UPLOAD_LABEL} (saw "${file.type || 'unknown'}").`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `File is ${mb} MB — the limit is 10 MB.`;
  }
  return null;
}
