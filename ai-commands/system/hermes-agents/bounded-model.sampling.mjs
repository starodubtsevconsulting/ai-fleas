export class BoundedModelSampling {
  constructor(values = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)
      || Object.keys(values).some((key) => !['temperature', 'top_p', 'top_k', 'presence_penalty'].includes(key))) {
      throw new Error('Invalid bounded model sampling configuration');
    }
    const { temperature = 0, top_p, top_k, presence_penalty } = values;
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('Invalid sampling temperature');
    if (top_p !== undefined && (!Number.isFinite(top_p) || top_p <= 0 || top_p > 1)) throw new Error('Invalid sampling top_p');
    if (top_k !== undefined && (!Number.isSafeInteger(top_k) || top_k < 1 || top_k > 100)) throw new Error('Invalid sampling top_k');
    if (presence_penalty !== undefined && (!Number.isFinite(presence_penalty) || presence_penalty < -2 || presence_penalty > 2)) throw new Error('Invalid sampling presence_penalty');
    this.values = { temperature, ...(top_p === undefined ? {} : { top_p }),
      ...(top_k === undefined ? {} : { top_k }),
      ...(presence_penalty === undefined ? {} : { presence_penalty }) };
    this.configured = values;
  }
  requestFields() { return { ...this.values }; }
  commandArguments() {
    const flags = { temperature: '--temperature', top_p: '--top-p', top_k: '--top-k', presence_penalty: '--presence-penalty' };
    return Object.entries(flags).flatMap(([key, flag]) =>
      this.configured[key] === undefined ? [] : [flag, String(this.values[key])]);
  }
}
