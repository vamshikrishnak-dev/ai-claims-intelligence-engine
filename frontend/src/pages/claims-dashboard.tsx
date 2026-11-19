import { claimsApi } from '../services/claims-api';
import { useResource } from '../hooks/use-resource';
import { DateLabel, LoadingError, Notice, StatusBadge } from '../components/presentation';

export function ClaimsDashboard() {
  const { data: claims, error, retry } = useResource(claimsApi.list);

  return <>
    <section className="dashboard-head">
      <div>
        <h1>Claims dashboard</h1>
        <p>Track cosmetic product claims from proposal to evidence assessment.</p>
      </div>
      <a className="button primary" href="#new-claim">+ New claim</a>
    </section>

    {claims && <section aria-label="Claim summary" className="metrics">
      <div><span>Total claims</span><strong>{claims.length}</strong></div>
      <div><span>Awaiting review</span><strong>{claims.filter(({ status }) => status === 'PROPOSED').length}</strong></div>
      <div><span>Approved</span><strong>{claims.filter(({ status }) => status === 'APPROVED').length}</strong></div>
    </section>}

    <section className="panel claims-panel" aria-labelledby="claims-heading">
      <header className="section-head">
        <h2 id="claims-heading">Product claims</h2>
        {claims && <span className="muted">{claims.length} {claims.length === 1 ? 'claim' : 'claims'}</span>}
      </header>
      {error && <LoadingError message={error} retry={retry} />}
      {!claims && !error && <Notice>Loading claims…</Notice>}
      {claims?.length === 0 && <div className="empty">
        <h3>No claims yet</h3>
        <p>Create a claim to begin the workflow.</p>
        <a href="#new-claim" className="button secondary">Create a claim</a>
      </div>}
      {!!claims?.length && <div className="claim-list">
        <div className="claim-row table-head" aria-hidden="true">
          <span>Claim</span><span>Status</span><span>Created</span><span />
        </div>
        <ul>
          {claims.map((claim) => <li className="claim-row" key={claim.id}>
            <div className="claim-name">
              <strong>{claim.title}</strong>
              <p>{claim.claimText}</p>
            </div>
            <div><StatusBadge status={claim.status} /></div>
            <div className="muted"><DateLabel value={claim.createdAt} /></div>
            <a href={`#claims/${claim.id}`} className="button secondary" aria-label={`View details: ${claim.title}`}>View details</a>
          </li>)}
        </ul>
      </div>}
    </section>
  </>;
}
