export interface PipelineWorkflowIdentityInput {
  projectId?: string | null;
  vehicleId?: string | null;
  vin?: string | null;
  inputImages: readonly string[];
}

function imageFingerprint(image: string): string {
  const sample = `${image.slice(0, 48)}:${image.slice(-48)}`;
  let hash = 2166136261;
  for (let index = 0; index < sample.length; index += 1) {
    hash ^= sample.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${image.length}-${(hash >>> 0).toString(36)}`;
}

/** Stable identity for one remastered vehicle batch without retaining image data. */
export function createPipelineWorkflowKey(input: PipelineWorkflowIdentityInput): string {
  const owner = input.vehicleId || input.projectId || input.vin || 'unassigned';
  const images = input.inputImages.map(imageFingerprint).join('.');
  return `${owner}:${input.inputImages.length}:${images}`;
}

export function pipelineRunMatchesWorkflow(
  activeWorkflowKey: string | null | undefined,
  currentWorkflowKey: string,
): boolean {
  return Boolean(activeWorkflowKey && activeWorkflowKey === currentWorkflowKey);
}