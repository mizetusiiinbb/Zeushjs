const fs = require("fs");
const vm = require("vm");
const JavaScriptObfuscator = require("javascript-obfuscator");
const esbuild = require("esbuild");

const [, , input, output, rawOptions] = process.argv;
const opts = JSON.parse(rawOptions || "{}");
const source = fs.readFileSync(input, "utf8");

// Cloudflare-safe defaults: avoid transformations known to be fragile for Workers.
// The UI exposes stronger options separately.
const config = {
  compact: opts.compact !== false,
  simplify: true,
  identifierNamesGenerator: opts.identifierNames ? "hexadecimal" : "mangled",
  renameGlobals: false,
  stringArray: opts.stringArray !== false,
  stringArrayEncoding: opts.stringArray && opts.stringEncoding === "rc4" ? ["rc4"] : ["base64"],
  stringArrayThreshold: 0.75,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: "function",
  splitStrings: false,
  numbersToExpressions: true,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  deadCodeInjection: opts.deadCode === true,
  deadCodeInjectionThreshold: opts.deadCode === true ? 0.12 : 0,
  controlFlowFlattening: opts.controlFlow === true,
  controlFlowFlatteningThreshold: opts.controlFlow === true ? 0.35 : 0,
  selfDefending: opts.selfDefending === true,
  debugProtection: false,
  disableConsoleOutput: opts.disableConsole === true,
  domainLock: [],
  reservedNames: [
    "fetch", "Request", "Response", "Headers", "WebSocket",
    "URL", "URLPattern", "crypto", "caches", "console",
    "addEventListener", "WebSocketPair", "HTMLRewriter",
    "D1Database", "env", "ctx", "scheduler", "waitUntil",
    "cloudflare", "connect", "close", "accept", "exports", "default"
  ]
};

// Parse/transform validation. esbuild is used only as a parser/minifier check;
// it does not replace the obfuscation engine.
try {
  esbuild.transformSync(source, { loader: "js", target: "es2022", format: "esm" });
} catch (e) {
  console.error("Input JavaScript syntax error:\n" + e.message);
  process.exit(2);
}

let obfuscated;
try {
  obfuscated = JavaScriptObfuscator.obfuscate(source, config).getObfuscatedCode();
} catch (e) {
  console.error("Obfuscation error:\n" + e.message);
  process.exit(3);
}

try {
  esbuild.transformSync(obfuscated, { loader: "js", target: "es2022", format: "esm" });
} catch (e) {
  console.error("Generated JavaScript failed syntax validation:\n" + e.message);
  process.exit(4);
}

fs.writeFileSync(output, obfuscated, "utf8");
