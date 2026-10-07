#!/usr/bin/env bash
ai_suitability(){
 local dev="$1" json="$2" rota tran size model
 rota="$(lsblk -dn -o ROTA "$dev" | xargs)"; tran="$(lsblk -dn -o TRAN "$dev" | xargs)"
 size="$(lsblk -dn -o SIZE "$dev" | xargs)"; model="$(lsblk -dn -o MODEL "$dev" | xargs)"
 local persistent="GOOD" documents="GOOD" archive="GOOD" model_library="GOOD" vector="CONDITIONAL" active_inference="POOR" workspace="POOR"
 local reason="Rotational storage favors capacity and sequential/archive workloads; latency-sensitive random I/O should use SSD/NVMe."
 if [[ "$rota" == "0" ]]; then persistent="GOOD"; documents="GOOD"; archive="GOOD"; model_library="GOOD"; vector="GOOD"; active_inference="GOOD"; workspace="GOOD"; reason="Non-rotational storage is generally suitable for persistent AI data and latency-sensitive random I/O; benchmark demanding workloads."; fi
 if [[ "$json" == 1 ]]; then
   printf '{"device":"%s","model":"%s","size":"%s","transport":"%s","rotational":%s,"ai_suitability":{"agent_persistent_memory":"%s","knowledge_documents":"%s","backup_archive":"%s","cold_model_library":"%s","vector_search":"%s","active_inference_storage":"%s","agent_workspace_builds":"%s"},"reason":"%s"}\n' "$dev" "$model" "$size" "$tran" "$rota" "$persistent" "$documents" "$archive" "$model_library" "$vector" "$active_inference" "$workspace" "$reason"
 else
   printf 'AI Fleas · AI Workload Suitability\n───────────────────────────────────\nAgent persistent memory: %s\nKnowledge/document store: %s\nBackup/archive: %s\nCold model library: %s\nVector/search storage: %s\nActive inference storage: %s\nAgent workspace/builds: %s\n\nReason: %s\n' "$persistent" "$documents" "$archive" "$model_library" "$vector" "$active_inference" "$workspace" "$reason"
 fi
 return 0
}
