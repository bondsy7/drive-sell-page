import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import Nb21V2ReferenceCheck from '@/components/Nb21V2ReferenceCheck';
import { assignV2DetailRoles, checkV2Preflight } from '@/lib/nb21-v2-preflight';
import type { V2Reference } from '@/prompts/nb21/v2';
afterEach(cleanup);
const sources: V2Reference[] = [
  { sourceId: 'detail:1', sourceRole: 'unassigned-detail', sourceType: 'original', image: 'data:image/jpeg;base64,YQ==' },
  { sourceId: 'rear', sourceRole: 'rear', sourceType: 'original', image: 'data:image/jpeg;base64,YQ==' },
];
it('manual assignment updates preflight and skipping removes the missing job', () => {
  const launch = vi.fn();
  function Harness() {
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [jobs, setJobs] = useState([{ key: 'CI_VOLVO_INT_BOOT', labelDe: 'Kofferraum' }]);
    const assigned = assignV2DetailRoles(sources, assignments);
    const results = checkV2Preflight(jobs, assigned);
    return <><Nb21V2ReferenceCheck results={results} sources={assigned} onAssign={(id, role) => setAssignments({ [id]: role })} onSkip={key => setJobs(jobs.filter(j => j.key !== key))} /><button disabled={jobs.length === 0 || results.some(r => !r.ready)} onClick={() => launch(jobs, assigned)}>Start</button></>;
  }
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  fireEvent.click(screen.getByRole('combobox', { name: 'Detailbild 1 zuordnen' }));
  fireEvent.click(screen.getByRole('option', { name: 'Kofferraum / Laderaum' }));
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(launch.mock.calls[0]?.[1][0].sourceRole).toBe('cargo');
});
it('skip is explicit and identifies the affected job', () => {
  const onSkip = vi.fn();
  render(<Nb21V2ReferenceCheck results={checkV2Preflight([{ key: 'CI_VOLVO_INT_BOOT', labelDe: 'Kofferraum' }], sources)} sources={sources} onAssign={vi.fn()} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kofferraum überspringen' }));
  expect(onSkip).toHaveBeenCalledWith('CI_VOLVO_INT_BOOT');
});