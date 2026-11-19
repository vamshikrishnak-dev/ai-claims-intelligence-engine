import { useEffect, useState } from 'react';
import { Brand } from './components/presentation';
import { ClaimDetailsPage } from './pages/claim-details';
import { ClaimsDashboard } from './pages/claims-dashboard';
import { CreateClaimPage } from './pages/create-claim';
import './styles.css';

function currentRoute() {
  return window.location.hash.slice(1) || 'claims';
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    function navigate() {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    }

    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  const claimId = /^claims\/([^/]+)$/.exec(route)?.[1];
  const dashboard = route === 'claims';

  useEffect(() => {
    document.title = `${dashboard ? 'Claims dashboard' : route === 'new-claim' ? 'Propose a claim' : 'Claim details'} · AI Claims Intelligence Engine`;
  }, [dashboard, route]);

  return <>
    <header className="app-header">
      <div className="header-inner">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#claims" className="nav-link" aria-current={dashboard ? 'page' : undefined}>Claims dashboard</a>
        </nav>
      </div>
    </header>
    <main className="workspace">
      {claimId ? <ClaimDetailsPage key={claimId} claimId={claimId} />
        : route === 'new-claim' ? <CreateClaimPage />
        : <ClaimsDashboard />}
    </main>
  </>;
}
