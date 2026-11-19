import { ClaimForm } from '../components/workflow-forms';
import { Notice } from '../components/presentation';
import { useAction } from '../hooks/use-action';
import { claimsApi } from '../services/claims-api';

export function CreateClaimPage() {
  const action = useAction();

  return <>
    <a className="back-link" href="#claims">All claims</a>
    <section className="panel form-page" aria-labelledby="create-heading">
      <h1 id="create-heading">Propose a claim</h1>
      <p className="muted">Enter the exact wording to be assessed against clinical evidence.</p>
      {action.error && <Notice kind="error">{action.error}</Notice>}
      <ClaimForm pending={action.pending} submit={(input) => action.run(async () => {
        const claim = await claimsApi.create(input);
        window.location.hash = 'claims/' + claim.id;
      })} />
    </section>
  </>;
}
