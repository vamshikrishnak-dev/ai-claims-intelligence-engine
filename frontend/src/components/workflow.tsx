export const stages = [
  'Business Proposal',
  'Claim Manager Review',
  'Scientist Formula',
  'Clinical Study',
  'AI Assessment',
] as const;

export function Workflow({
  active, completed, choose, busy, rejected,
}: {
  active: number;
  completed: boolean[];
  choose: (stage: number) => void;
  busy: boolean;
  rejected: boolean;
}) {
  return <nav aria-label="Claim workflow" className="workflow">
    <ol>
      {stages.map((label, index) => (
        <li key={label}>
          <button
            type="button"
            aria-current={index === active ? 'step' : undefined}
            aria-label={label + (index === 1 && rejected ? ', rejected' : completed[index] ? ', complete' : '')}
            onClick={() => choose(index)}
            disabled={busy}
          >
            <span className={`step-icon ${index === 1 && rejected ? 'blocked' : completed[index] ? 'complete' : ''}`} aria-hidden="true">
              {index === 1 && rejected ? '×' : completed[index] ? '✓' : index + 1}
            </span>
            <span>{label}</span>
          </button>
        </li>
      ))}
    </ol>
  </nav>;
}
