import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Native doc pages author content as arrays of JSX cells (table rows, list
    // items). The `key` is applied where these arrays are mapped — inside the
    // Table/List/OL primitives — so jsx-key's static check is a false positive
    // here. These files are pure content, not interactive components.
    files: ["src/components/docs/pages/**/*.tsx"],
    rules: { "react/jsx-key": "off" },
  },
]);

export default eslintConfig;
