import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\DELL\.gemini\antigravity-ide\brain\ee4f34d6-a14c-4b46-be8f-4425a1f19b1c\.system_generated\logs\transcript.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    lines = [json.loads(line) for line in f]

for item in lines:
    step = item.get("step_index")
    # We want to focus on steps 1425 to 1484 (the steps right before the current session)
    if 1425 <= step < 1484:
        source = item.get("source")
        typ = item.get("type")
        content = item.get("content", "")
        print(f"=== STEP {step} ({source} - {typ}) ===")
        if typ == "USER_INPUT":
            print(content)
        elif typ == "PLANNER_RESPONSE":
            print(content[:400] + "...")
        elif "CODE_ACTION" in typ or "REPLACE_FILE" in typ or "WRITE_TO_FILE" in typ:
            print(content[:500])
        else:
            print(f"[Other details, size: {len(content)}]")
        print("-" * 50)
