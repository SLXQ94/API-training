import { useEffect } from 'react';
import { closeModal, useStore } from '../store';

/** The one confirm dialog ("Delete message?", "Log out?"), driven by store.modal */
export function ModalHost() {
  const modal = useStore((s) => s.modal);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  if (!modal) return null;
  return (
    <div className="modal-backdrop" onPointerDown={closeModal}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={modal.title} onPointerDown={(e) => e.stopPropagation()}>
        <h2>{modal.title}</h2>
        {modal.body && <p>{modal.body}</p>}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={closeModal}>
            Cancel
          </button>
          <button
            className="btn btn-solid"
            autoFocus
            onClick={() => {
              closeModal();
              modal.onConfirm();
            }}
          >
            {modal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      {toast.text}
    </div>
  );
}
