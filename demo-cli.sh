#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_PDF="$SCRIPT_DIR/Profile.pdf"

echo "🚀 LinkedIn PDF Parser CLI Demo"
echo "==============================="
echo

if [ ! -f "$PROFILE_PDF" ]; then
  echo "Profile fixture not found: $PROFILE_PDF"
  exit 1
fi

# Test CLI help
echo "📋 1. Showing help:"
node "$SCRIPT_DIR/bin/cli.js" --help
echo

# Test with Profile.pdf in compact mode
echo "📄 2. Parsing Profile.pdf (compact mode):"
echo "node bin/cli.js \"$PROFILE_PDF\" --compact"
echo
echo "Output (first 300 characters):"
node "$SCRIPT_DIR/bin/cli.js" "$PROFILE_PDF" --compact | head -c 300
echo "..."
echo

# Test with Profile.pdf showing just structure
echo "📄 3. Parsing Profile.pdf (structured output):"
echo "node bin/cli.js \"$PROFILE_PDF\""
echo
echo "Key fields extracted:"
RESULT_FILE=$(mktemp)
node "$SCRIPT_DIR/bin/cli.js" "$PROFILE_PDF" --compact > "$RESULT_FILE"
node --input-type=module - "$RESULT_FILE" <<'NODE'
import fs from 'fs';

const resultPath = process.argv[2];
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const { profile } = result;

console.log(`Name: ${profile.name}`);
console.log(`Email: ${profile.contact.email}`);
console.log(`Location: ${profile.location}`);
console.log(`Skills count: ${profile.top_skills.length}`);
console.log(`Experience count: ${profile.experience.length}`);
NODE
rm "$RESULT_FILE"
echo

# Test error handling
echo "🚨 4. Error handling examples:"
echo

echo "   a) Non-existent file:"
echo "   node bin/cli.js non-existent.pdf"
node "$SCRIPT_DIR/bin/cli.js" non-existent.pdf 2>&1 || true
echo

echo "   b) Non-PDF file:"
echo "   node bin/cli.js package.json"
node "$SCRIPT_DIR/bin/cli.js" "$SCRIPT_DIR/package.json" 2>&1 || true
echo

# Usage examples
echo "💡 5. Real-world usage examples:"
echo "   # Save to file:"
echo "   linkedin-pdf-parser resume.pdf > profile-data.json"
echo
echo "   # Extract specific data (with jq):"
echo "   linkedin-pdf-parser resume.pdf | jq '.profile.name'"
echo "   linkedin-pdf-parser resume.pdf | jq '.profile.contact.email'"
echo "   linkedin-pdf-parser resume.pdf | jq '.profile.experience[].company'"
echo
echo "   # Process multiple files:"
echo "   for pdf in *.pdf; do"
echo "     linkedin-pdf-parser \"\$pdf\" --compact > \"\${pdf%.pdf}.json\""
echo "   done"
echo

echo "✅ CLI Demo completed successfully!"
echo "📖 See README.md for complete documentation"
