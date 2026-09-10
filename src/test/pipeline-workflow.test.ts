import { describe, expect, it } from 'vitest';
import {
  createPipelineWorkflowKey,
  pipelineRunMatchesWorkflow,
} from '@/lib/pipeline-workflow';

describe('pipeline workflow isolation', () => {
  it('does not expose a finished run from another vehicle', () => {
    const skoda = createPipelineWorkflowKey({
      vehicleId: 'skoda-id',
      inputImages: ['data:image/jpeg;base64,SKODA'],
    });
    const volvo = createPipelineWorkflowKey({
      vehicleId: 'volvo-id',
      inputImages: ['data:image/jpeg;base64,VOLVO'],
    });

    expect(pipelineRunMatchesWorkflow(skoda, volvo)).toBe(false);
  });

  it('recognizes the same vehicle batch after reopening the runner', () => {
    const input = {
      vehicleId: 'volvo-id',
      vin: 'VOLVO123',
      inputImages: ['data:image/jpeg;base64,FRONT', 'data:image/jpeg;base64,REAR'],
    };

    expect(createPipelineWorkflowKey(input)).toBe(createPipelineWorkflowKey({ ...input }));
    expect(pipelineRunMatchesWorkflow(createPipelineWorkflowKey(input), createPipelineWorkflowKey(input))).toBe(true);
  });

  it('separates a newly remastered batch for the same vehicle', () => {
    const oldBatch = createPipelineWorkflowKey({ vehicleId: 'vehicle-id', inputImages: ['old-image'] });
    const newBatch = createPipelineWorkflowKey({ vehicleId: 'vehicle-id', inputImages: ['new-image'] });

    expect(pipelineRunMatchesWorkflow(oldBatch, newBatch)).toBe(false);
  });
});