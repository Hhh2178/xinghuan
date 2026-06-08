import { Loader2, Trash2 } from "lucide-react";
import type { ConfirmAction } from "./main";

export function ConfirmActionDialog({
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
      <section className={`admin-confirm-dialog ${action.tone}`}>
        <header>
          <div className="confirm-icon"><Trash2 aria-hidden="true" /></div>
          <div>
            <h3 id="confirm-action-title">{action.title}</h3>
            <p>{action.message}</p>
          </div>
        </header>
        <p className="confirm-detail">{action.detail}</p>
        <footer>
          <button type="button" className="ghost-action" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="danger-action solid" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {action.confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
