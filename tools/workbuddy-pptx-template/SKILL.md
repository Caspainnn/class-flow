---
name: workbuddy-pptx-template
description: Use the WorkBuddy model to turn an approved outline into content for marked slots in an existing editable PowerPoint template.
---

Use the configured WorkBuddy CLI for content generation. Read the supplied outline and the template slot list. Write only a JSON object whose keys are the slot names and whose values are nonempty single-line strings. Ground every value in the outline. Preserve the slide sequence and keep each value short enough for its slot. For an unspecified duration, omit time allocation from generated prose.

Apply the result with `python fill.py template.pptx fills.json output.pptx`. This prototype supports an already ordered template with a unique `{{slot_name}}` marker occupying an entire text run. Keep fixed template text outside these markers. Use a new output path and retain the original template. Check the resulting slide count and render the output when PowerPoint is available.

For a standalone run, use `node tools/workbuddy-pptx-template/run.cjs template.pptx outline.md new-output.pptx` from the project root. Include the slot names and what each represents in outline.md. The runner uses the existing WorkBuddy configuration and keeps the model output in its isolated run directory for inspection.
