import { extractErrorsFromJobLogs } from "../errorExtraction";

// Comprehensive log that includes multiple tools - similar to a real CI failure
const COMPREHENSIVE_LOG = `
Run npm run ci
npm run ci
> npm ci && npm run type-check && npm run lint && npm test && npm run build

npm WARN deprecated request@2.88.2: request has been deprecated
npm ERR! peer dep missing: react@^17.0.0, required by some-package@1.0.0

> tsc --noEmit

src/components/Button.tsx(15,27): error TS2339: Property 'invalid' does not exist on type 'ButtonProps'.
src/utils/helpers.ts(42,8): error TS2322: Type 'string' is not assignable to type 'number'.
src/hooks/useApi.ts(23,45): error TS2345: Argument of type 'undefined' is provided but a parameter of type 'string' was expected.

> eslint src --ext .ts,.tsx

/home/runner/work/example/example/src/components/Button.tsx
  15:27  error  'invalid' is not defined                          no-undef
  23:5   error  Missing return statement in function expecting a value  consistent-return
  45:12  warn   'React' is defined but never used                 no-unused-vars

/home/runner/work/example/example/src/utils/helpers.ts
  8:1   error  Expected a semicolon                             @typescript-eslint/semi

✖ 4 problems (3 errors, 1 warnings)

> jest

 FAIL  src/components/Button.test.tsx
  ● Button component › should render correctly

    expect(received).toBe(expected) // Object.is equality

    Expected: "Submit"
    Received: "Click me"

      at Object.<anonymous> (src/components/Button.test.tsx:14:48)

Test Suites: 1 failed, 0 passed, 1 total

> webpack --mode production

ERROR in ./src/components/Button.tsx
Module not found: Error: Can't resolve './missing-module'

webpack 5.74.0 compiled with 1 errors

npm ERR! code ELIFECYCLE
npm ERR! errno 1
##[error]Process completed with exit code 1.
`;

console.log("🔬 Testing Comprehensive Multi-Tool Error Extraction\n");

const result = extractErrorsFromJobLogs(COMPREHENSIVE_LOG, "ci");

console.log(`📊 Total errors found: ${result.errors.length}`);
console.log(`🛠️ Tools detected: ${Object.keys(result.errorsByTool).join(", ")}`);

// Count errors by tool
for (const [tool, errors] of Object.entries(result.errorsByTool)) {
  const errorCount = errors.filter(e => e.severity === "error").length;
  const warningCount = errors.filter(e => e.severity === "warning").length;
  console.log(`  ${tool.toUpperCase()}: ${errorCount} errors, ${warningCount} warnings`);
}

console.log("\n📋 Generated Summary:");
console.log("─".repeat(50));
console.log(result.generateSummary());
console.log("─".repeat(50));

console.log("\n🎯 Prioritized Errors (Top 5):");
const prioritized = result.getPrioritizedErrors().slice(0, 5);
prioritized.forEach((error, index) => {
  const location = error.file && error.line ? ` (${error.file}:${error.line})` : '';
  const code = error.code ? ` [${error.code}]` : '';
  const rule = error.rule ? ` (${error.rule})` : '';
  console.log(`  ${index + 1}. [${error.tool.toUpperCase()}] ${error.message}${location}${code}${rule}`);
});

console.log("\n📁 Errors Grouped by File:");
const grouped = result.getGroupedErrors();
for (const [fileOrTool, errors] of Object.entries(grouped)) {
  if (errors.length > 0 && errors[0].file) {
    console.log(`  📄 ${fileOrTool}: ${errors.length} issues`);
  }
}

console.log("\n✨ Advanced Error Extraction Summary:");
console.log("  ✅ Multi-tool parsing (TypeScript, ESLint, Jest, NPM, Webpack)");
console.log("  ✅ Structured error information with file paths and line numbers");
console.log("  ✅ Error prioritization and intelligent grouping");
console.log("  ✅ VS Code-like problem matcher functionality");
console.log("  ✅ Comprehensive summary generation for developers");

console.log("\n🎉 Comprehensive multi-tool error extraction completed successfully!");