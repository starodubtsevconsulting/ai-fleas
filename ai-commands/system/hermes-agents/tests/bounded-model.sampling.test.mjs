import assert from 'node:assert/strict';
import { BoundedModelSampling } from '../bounded-model.sampling.mjs';

const input = { temperature: 0.7 };
const sampling = new BoundedModelSampling(input);
input.temperature = 9;
input.top_p = 0.8;
assert.deepEqual(sampling.requestFields(), { temperature: 0.7 });
assert.deepEqual(sampling.commandArguments(), ['--temperature', '0.7']);

const complete = new BoundedModelSampling({ temperature: 0.7, top_p: 0.8, top_k: 20, presence_penalty: 1.5 });
assert.deepEqual(complete.commandArguments(), [
  '--temperature', '0.7', '--top-p', '0.8', '--top-k', '20', '--presence-penalty', '1.5',
]);
assert.throws(() => new BoundedModelSampling({ top_p: 0 }), /Invalid sampling top_p/);
