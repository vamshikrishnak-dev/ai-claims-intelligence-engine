import type {
  Assessment, AssessmentHistoryItem, Claim, ClaimDetail, ClaimInput, ClaimReview,
  ClinicalStudy, Formula, FormulaInput, ReviewInput, StudyInput,
} from '../types/claims';

const fallbackMessages: Record<number, string> = {
  400: 'Check the submitted fields and try again.',
  404: 'The requested record could not be found.',
  409: 'This action is unavailable at the current workflow stage.',
  413: 'The submission is too large. Shorten the evidence and try again.',
  502: 'The assessment provider could not return a valid result. Try again later.',
  504: 'The assessment provider timed out. Try again later.',
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, options);
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new Error('Could not reach the API. Check your connection and try again.');
  }

  if (!response.ok) {
    const fallback = fallbackMessages[response.status] ?? 'The server could not complete the request. Try again.';
    const body = response.status === 400 || response.status === 404 || response.status === 409
      ? await response.json().catch(() => null) : null;

    const message: unknown = body?.message;
    if (typeof message === 'string' && message.trim()) throw new Error(message);
    if (Array.isArray(message) && message.every((item) => typeof item === 'string') && message.length) {
      throw new Error(message.join(' '));
    }
    throw new Error(fallback);
  }

  try {
    return await response.json() as T;
  } catch {
    throw new Error('The API returned an unreadable response. Check that the backend is running.');
  }
}

function post<T>(path: string, payload: object) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export const claimsApi = {
  list: (signal: AbortSignal) => request<Claim[]>('/claims', { signal }),
  detail: (id: string, signal: AbortSignal) => request<ClaimDetail>('/claims/' + encodeURIComponent(id), { signal }),
  create: (input: ClaimInput) => post<Claim>('/claims', input),
  review: (id: string, input: ReviewInput) =>
    post<ClaimReview & { claimStatus: Claim['status'] }>('/claims/' + id + '/reviews', input),
  submitFormula: (id: string, input: FormulaInput) => post<Formula>('/claims/' + id + '/formulas', input),
  submitStudy: (id: string, input: StudyInput) => post<ClinicalStudy>('/claims/' + id + '/studies', input),
  assess: (claimId: string, clinicalStudyId: string) =>
    post<Assessment>('/claims/assess', { claimId, clinicalStudyId }),
  history: (id: string, signal: AbortSignal) =>
    request<AssessmentHistoryItem[]>('/claims/' + encodeURIComponent(id) + '/assessments', { signal }),
};
