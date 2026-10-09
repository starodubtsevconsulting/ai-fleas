/** Keep Pi's native compaction semantics while selecting the auxiliary model. */
import fs from 'node:fs';
import { compact, type ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function (pi: ExtensionAPI) {
  pi.on('session_before_compact', async (event, ctx) => {
    const { signal, preparation, customInstructions } = event;
    if (signal.aborted) return { cancel: true };
    try {
      const binding = JSON.parse(fs.readFileSync(new URL('./auxiliary-model.json', import.meta.url), 'utf8'));
      const model = ctx.modelRegistry.find(binding.provider, binding.model);
      if (!model) throw new Error('Auxiliary compaction model is unavailable');
      ctx.ui.notify(`Compacting with ${model.id}`, 'info');
      // Pi's compact preserves cut points, split turns, prior summaries, file lists,
      // user instructions and usage. Registry streaming resolves current credentials.
      const result = await compact(
        preparation, model, undefined, undefined, customInstructions, signal, 'low',
        (selected, context, options) => ctx.modelRegistry.streamSimple(selected, context, options),
      );
      if (signal.aborted) return { cancel: true };
      // File-operation tags alone are not a usable checkpoint.
      const summaryText = result.summary.replace(/<(read-files|modified-files)>[\s\S]*?<\/\1>/g, '').trim();
      if (!summaryText || /^(No prior history\.)?(\s|---|\*\*Turn Context \(split turn\):\*\*)*$/.test(summaryText)) {
        throw new Error('Auxiliary compaction returned an empty summary');
      }
      return { compaction: result };
    } catch {
      if (signal.aborted) return { cancel: true };
      // Avoid displaying provider errors, which can contain endpoint or auth data.
      ctx.ui.notify('Auxiliary compaction failed; using the active model for normal Pi compaction', 'warning');
      return;
    }
  });
}
