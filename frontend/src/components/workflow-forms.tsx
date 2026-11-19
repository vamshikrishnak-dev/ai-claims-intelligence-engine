import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ClaimInput, Formula, FormulaInput, ReviewInput, StudyInput } from '../types/claims';

type SubmitProps<T> = {
  pending: boolean;
  submit: (input: T) => Promise<void>;
};

function read(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

function text(data: FormData, field: string) {
  return String(data.get(field) ?? '').trim();
}

function optionalText(data: FormData, field: string) {
  return text(data, field) || undefined;
}

function optionalNumber(data: FormData, field: string) {
  const value = text(data, field);
  return value ? Number(value) : undefined;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return <button className="button primary" type="submit" disabled={pending}>
    {pending ? 'Saving…' : label}
  </button>;
}

export function ClaimForm({ pending, submit }: SubmitProps<ClaimInput>) {
  return <form onSubmit={(event) => {
    const data = read(event);
    void submit({ title: text(data, 'title'), claimText: text(data, 'claimText') });
  }}>
    <fieldset disabled={pending} className="fields">
      <Field label="Claim title"><input name="title" required maxLength={200} /></Field>
      <Field label="Claim text"><textarea name="claimText" required maxLength={4000} rows={4} /></Field>
      <div><SubmitButton pending={pending} label="Create claim" /></div>
    </fieldset>
  </form>;
}

export function ReviewForm({ pending, submit }: SubmitProps<ReviewInput>) {
  return <form onSubmit={(event) => {
    const data = read(event);
    void submit({
      applicable: data.get('applicable') === 'true',
      feasible: data.get('feasible') === 'true',
      reviewNotes: text(data, 'reviewNotes'),
    });
  }}>
    <fieldset disabled={pending} className="fields">
      <div className="field-grid">
        {(['applicable', 'feasible'] as const).map((field) => (
          <Field key={field} label={field === 'applicable' ? 'Applicable' : 'Feasible'}>
            <select name={field} defaultValue="" required>
              <option value="" disabled>Select a decision</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </Field>
        ))}
      </div>
      <Field label="Review notes"><textarea name="reviewNotes" required maxLength={4000} rows={3} /></Field>
      <div><SubmitButton pending={pending} label="Submit review" /></div>
    </fieldset>
  </form>;
}

function useRows() {
  const [rows, setRows] = useState([0]);
  const nextId = useRef(1);

  function append() {
    const id = nextId.current++;
    setRows((previous) => [...previous, id]);
  }

  return { rows, append, remove: (id: number) => setRows((previous) => previous.filter((row) => row !== id)) };
}

export function FormulaForm({ pending, submit }: SubmitProps<FormulaInput>) {
  const { rows, append, remove } = useRows();

  return <form onSubmit={(event) => {
    const data = read(event);
    void submit({
      formulaName: text(data, 'formulaName'),
      description: text(data, 'description'),
      ingredients: rows.map((id) => ({
        name: text(data, `ingredient-${id}`),
        amount: optionalText(data, `amount-${id}`),
      })),
    });
  }}>
    <fieldset disabled={pending} className="fields">
      <Field label="Formula name"><input name="formulaName" required maxLength={200} /></Field>
      <Field label="Description"><textarea name="description" required maxLength={4000} rows={3} /></Field>
      <div className="repeatable">
        <h3>Ingredient composition</h3>
        {rows.map((id, index) => <div className="ingredient-row" key={id}>
          <Field label={`Ingredient ${index + 1} name`}><input name={`ingredient-${id}`} required maxLength={200} /></Field>
          <Field label="Amount (optional)"><input name={`amount-${id}`} placeholder="e.g. 2%" maxLength={1000} /></Field>
          {rows.length > 1 && <button type="button" className="quiet remove" aria-label={`Remove ingredient ${index + 1}`}
            onClick={() => remove(id)}>Remove</button>}
        </div>)}
        <button type="button" className="button secondary" onClick={append} disabled={rows.length >= 100}>+ Add ingredient</button>
      </div>
      <div><SubmitButton pending={pending} label="Submit formula" /></div>
    </fieldset>
  </form>;
}

export function StudyForm({ pending, submit, formulas }: SubmitProps<StudyInput> & { formulas: Formula[] }) {
  const { rows, append, remove } = useRows();

  return <form onSubmit={(event) => {
    const data = read(event);
    void submit({
      formulaId: text(data, 'formulaId'),
      studyTitle: text(data, 'studyTitle'),
      studyDesign: optionalText(data, 'studyDesign'),
      sampleSize: optionalNumber(data, 'sampleSize'),
      population: optionalText(data, 'population'),
      measuredEffect: optionalNumber(data, 'measuredEffect'),
      effectUnit: optionalText(data, 'effectUnit'),
      durationWeeks: optionalNumber(data, 'durationWeeks'),
      comparator: optionalText(data, 'comparator'),
      sourceExcerpts: rows.map((id) => text(data, `excerpt-${id}`)).filter(Boolean).map((excerpt) => ({ text: excerpt })),
    });
  }}>
    <fieldset disabled={pending} className="fields">
      <p className="muted field-hint">Use fictional study data for this demonstration. Only the formula and study title are required.</p>
      <div className="field-grid">
        <Field label="Tested formula">
          <select name="formulaId" defaultValue={formulas[0]?.id ?? ''} required>
            {formulas.map((formula) => <option value={formula.id} key={formula.id}>{formula.formulaName}</option>)}
          </select>
        </Field>
        <Field label="Study title"><input name="studyTitle" required maxLength={200} /></Field>
        <Field label="Study design"><input name="studyDesign" maxLength={4000} /></Field>
        <Field label="Sample size"><input name="sampleSize" type="number" min={1} step={1} max={2147483647} /></Field>
        <Field label="Population"><input name="population" maxLength={4000} /></Field>
        <Field label="Comparator"><input name="comparator" maxLength={4000} /></Field>
        <Field label="Measured effect"><input name="measuredEffect" type="number" step="any" /></Field>
        <Field label="Effect unit"><input name="effectUnit" placeholder="e.g. percent reduction in wrinkle depth" maxLength={200} /></Field>
        <Field label="Study duration (weeks)"><input name="durationWeeks" type="number" min="0" step="any" /></Field>
      </div>
      <div className="repeatable">
        <h3>Evidence excerpts</h3>
        <p className="muted field-hint">Add each excerpt separately. The server assigns a reference ID to each excerpt.</p>
        {rows.map((id, index) => <div className="excerpt-row" key={id}>
          <Field label={`Evidence excerpt ${index + 1}`}><textarea name={`excerpt-${id}`} maxLength={8000} rows={3} /></Field>
          {rows.length > 1 && <button type="button" className="quiet remove" aria-label={`Remove excerpt ${index + 1}`}
            onClick={() => remove(id)}>Remove</button>}
        </div>)}
        <button type="button" className="button secondary" onClick={append} disabled={rows.length >= 50}>+ Add excerpt</button>
      </div>
      <div><SubmitButton pending={pending} label="Submit study" /></div>
    </fieldset>
  </form>;
}
