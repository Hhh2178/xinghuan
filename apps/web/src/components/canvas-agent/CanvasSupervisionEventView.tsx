import type { CanvasRunEvent, CanvasRunPlanStep } from './canvas-run-api';
import { canvasRunEventLabel, canvasRunStepDisplayName } from './canvas-run-view-model';

export function CanvasSupervisionEventView(props: { events: CanvasRunEvent[]; steps: CanvasRunPlanStep[] }) {
  const stepNames = new Map(props.steps.flatMap((step) => [
    [step.id, canvasRunStepDisplayName(step)],
    [step.nodeId, canvasRunStepDisplayName(step)],
  ]));
  return <div className="canvas-supervision-workspace" data-view="events">
    <div className="canvas-run-events">
      {props.events.length === 0 ? <p>运行事件将在这里按服务端顺序出现。</p> : props.events.slice(-50).reverse().map((event) => {
        const stepName = stepNames.get(event.runStepKey || '') || stepNames.get(event.runStepId || '') || stepNames.get(event.nodeId || '');
        return <div key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString()}</time><span><strong>{canvasRunEventLabel(event.eventType)}</strong>{stepName ? <small>{stepName}</small> : null}</span></div>;
      })}
    </div>
  </div>;
}
