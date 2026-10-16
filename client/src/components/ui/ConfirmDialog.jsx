import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title = 'Confirm Action', message, confirmText = 'Confirm', danger = false, loading = false }) => (
  <Modal isOpen={isOpen} onClose={onClose} size="sm">
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-full ${danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
          <AlertTriangle className={`w-6 h-6 ${danger ? 'text-red-500' : 'text-yellow-500'}`} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{message}</p>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary text-sm" disabled={loading}>Cancel</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={danger ? 'btn-danger text-sm' : 'btn-primary text-sm'}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </div>
  </Modal>
);

export default ConfirmDialog;
