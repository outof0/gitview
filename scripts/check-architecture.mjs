#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exceptionFile = path.join(
  root,
  "docs/maintainers/quality-exceptions.json",
);
const ignoredDirectories = new Set(["__tests__", "__benchmarks__", "test"]);
const sourceExtensions = new Set([".ts", ".tsx"]);
const assetPattern = /\.(?:css|gif|jpe?g|json|less|png|sass|scss|svg|ttf|woff2?)$/i;
const builtins = new Set(
  builtinModules.flatMap((name) => [
    name,
    name.startsWith("node:") ? name : `node:${name}`,
  ]),
);

function repoPath(absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (
      entry.isFile() &&
      sourceExtensions.has(path.extname(entry.name)) &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.includes(".test.")
    ) {
      files.push(absolutePath);
    }
  }
  return files;
}

function isTypeOnlyImport(node) {
  const clause = node.importClause;
  if (!clause) {
    return false;
  }
  if (clause.isTypeOnly) {
    return true;
  }
  return Boolean(
    !clause.name &&
    clause.namedBindings &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly),
  );
}

function readReferences(absolutePath) {
  const sourceText = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const references = [];

  function addReference(specifier, typeOnly, line) {
    references.push({ specifier, typeOnly, line });
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        node.moduleSpecifier.text,
        isTypeOnlyImport(node),
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        node.moduleSpecifier.text,
        node.isTypeOnly,
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      addReference(
        node.moduleReference.expression.text,
        node.isTypeOnly,
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      addReference(
        node.arguments[0].text,
        false,
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { sourceFile, references };
}

function resolveLocalImport(fromFile, specifier) {
  let base;
  if (specifier === "@gitview/types") {
    base = path.join(root, "src/types/index");
  } else if (specifier.startsWith("@gitview/shared/")) {
    base = path.join(
      root,
      "src/shared",
      specifier.slice("@gitview/shared/".length),
    );
  } else if (specifier === "@gitview/shared") {
    base = path.join(root, "src/shared/index");
  } else if (specifier.startsWith(".")) {
    if (assetPattern.test(specifier)) {
      return { kind: "asset" };
    }
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return { kind: "external", specifier };
  }

  const candidateBases = [base];
  const relativeBase = repoPath(base);
  if (relativeBase.startsWith("out/")) {
    candidateBases.push(path.join(root, "src", relativeBase.slice("out/".length)));
  }
  const candidates = candidateBases.flatMap((candidateBase) => {
    const candidateExtension = path.extname(candidateBase);
    const withoutJavaScriptExtension = /\.[cm]?js$/.test(candidateExtension)
      ? candidateBase.slice(0, -candidateExtension.length)
      : candidateBase;
    return sourceExtensions.has(candidateExtension)
      ? [candidateBase]
      : [
          `${withoutJavaScriptExtension}.ts`,
          `${withoutJavaScriptExtension}.tsx`,
          path.join(withoutJavaScriptExtension, "index.ts"),
          path.join(withoutJavaScriptExtension, "index.tsx"),
        ];
  });
  const target = candidates.find((candidate) => fs.existsSync(candidate));
  return target
    ? { kind: "local", target: path.resolve(target) }
    : { kind: "unresolved", specifier };
}

function startsWithPath(file, prefix) {
  return file === prefix || file.startsWith(`${prefix}/`);
}

function isOneOf(file, prefixes) {
  return prefixes.some((prefix) => startsWithPath(file, prefix));
}

const files = [
  ...collectSourceFiles(path.join(root, "src")),
  ...collectSourceFiles(path.join(root, "webview/src")),
].sort();
const e2eFiles = collectSourceFiles(path.join(root, "e2e")).sort();
const fileSet = new Set(files);
const graph = new Map(files.map((file) => [file, new Set()]));
const violations = [];
let internalDependencyCount = 0;

function addViolation(rule, file, message, dependency) {
  violations.push({
    rule,
    file: typeof file === "string" ? file : repoPath(file),
    dependency,
    message,
  });
}

function checkDeterminism(sourceFile, file) {
  function visit(node) {
    const isNondeterministicCall =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ((node.expression.expression.getText(sourceFile) === "Date" &&
        node.expression.name.text === "now") ||
        (node.expression.expression.getText(sourceFile) === "Math" &&
          node.expression.name.text === "random"));
    const isImplicitDate =
      ts.isNewExpression(node) &&
      node.expression.getText(sourceFile) === "Date" &&
      (node.arguments?.length ?? 0) === 0;
    if (isNondeterministicCall || isImplicitDate) {
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      addViolation(
        "core/determinism",
        file,
        `core must receive time/randomness from its caller (line ${line})`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const GIT_DIAGNOSTIC_PHRASES = [
  "not fully merged",
  "non-fast-forward",
  "fetch first",
  "unmerged paths",
  "no such path",
  "bad revision",
  "No local changes to save",
  "No stash entries found",
  "Authentication failed",
  "contains modified or untracked files",
];

/**
 * Git localizes its diagnostics, so reading them is only safe inside the
 * classifier (which is paired with the C-locale pin in exec.ts). Any other
 * module that *matches* against these phrases has reintroduced a
 * locale-dependent bug. Using them as display copy is fine, so only string
 * literals in a matching position (includes/startsWith/test/indexOf) count.
 */
function checkGitDiagnosticStrings(sourceFile, file) {
  if (file === "src/shared/errors/classifyGitError.ts") {
    return;
  }
  const matchers = new Set([
    "includes",
    "startsWith",
    "endsWith",
    "indexOf",
    "search",
    "match",
    "test",
  ]);

  function containsPhrase(text) {
    return GIT_DIAGNOSTIC_PHRASES.find((phrase) =>
      text.toLowerCase().includes(phrase.toLowerCase()),
    );
  }

  function reportIfPhrase(node, text) {
    const matched = containsPhrase(text);
    if (!matched) {
      return;
    }
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    addViolation(
      "runtime/git-diagnostic-strings",
      file,
      `Git output must be interpreted via classifyGitError, not matched inline (line ${line}, "${matched}")`,
    );
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      matchers.has(node.expression.name.text)
    ) {
      for (const argument of node.arguments) {
        if (ts.isStringLiteralLike(argument)) {
          reportIfPhrase(argument, argument.text);
        } else if (ts.isRegularExpressionLiteral(argument)) {
          reportIfPhrase(argument, argument.text);
        }
      }
      if (ts.isRegularExpressionLiteral(node.expression.expression)) {
        reportIfPhrase(
          node.expression.expression,
          node.expression.expression.text,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const foundationPrefixes = ["src/core", "src/shared", "src/types"];
const infrastructurePrefixes = [
  "src/config",
  "src/observability",
  "src/services",
  "src/storage",
  "src/util",
];
const outwardPrefixes = [
  "src/application",
  "src/commands",
  "src/webview",
  "src/webviewHost",
];
/** Entry points and the VS Code integration harness sit outside the layering. */
const unlayeredPrefixes = [
  "src/activation.ts",
  "src/extension.ts",
  "src/publicApi.ts",
  "src/test",
];
const layeredPrefixes = [
  ...foundationPrefixes,
  ...infrastructurePrefixes,
  ...outwardPrefixes,
  ...unlayeredPrefixes,
];

for (const absoluteFile of files) {
  const file = repoPath(absoluteFile);
  // An unclassified directory silently opts out of every rule below, so a new
  // top-level folder must be assigned a layer before it can be imported.
  if (startsWithPath(file, "src") && !isOneOf(file, layeredPrefixes)) {
    addViolation(
      "layering/unclassified",
      absoluteFile,
      "file is not in any declared architecture layer",
      null,
    );
  }
  const { sourceFile, references } = readReferences(absoluteFile);
  if (startsWithPath(file, "src/core")) {
    checkDeterminism(sourceFile, absoluteFile);
  }
  checkGitDiagnosticStrings(sourceFile, file);

  for (const reference of references) {
    const resolved = resolveLocalImport(absoluteFile, reference.specifier);
    if (resolved.kind === "asset") {
      continue;
    }
    if (resolved.kind === "unresolved") {
      addViolation(
        "imports/unresolved",
        absoluteFile,
        `cannot resolve local import at line ${reference.line}`,
        reference.specifier,
      );
      continue;
    }

    const external = resolved.kind === "external";
    const target = resolved.kind === "local" ? repoPath(resolved.target) : null;
    if (resolved.kind === "local") {
      internalDependencyCount++;
      if (fileSet.has(resolved.target)) {
        graph.get(absoluteFile).add(resolved.target);
      } else if (
        target?.includes("/__tests__/") ||
        target?.includes("/test/") ||
        target?.includes(".test.")
      ) {
        addViolation(
          "imports/test-code",
          absoluteFile,
          `production code imports test code at line ${reference.line}`,
          target,
        );
      }
    }

    if (startsWithPath(file, "src/core")) {
      const allowed =
        target &&
        (startsWithPath(target, "src/core") ||
          (reference.typeOnly && startsWithPath(target, "src/types")));
      if (!allowed) {
        addViolation(
          "core/dependency",
          absoluteFile,
          `core may only import core modules or type-only contracts at line ${reference.line}`,
          target ?? reference.specifier,
        );
      }
    }

    if (
      startsWithPath(file, "src/shared") &&
      (external || !target || !isOneOf(target, foundationPrefixes))
    ) {
      addViolation(
        "foundation/dependency",
        absoluteFile,
        `shared code may only depend on core/shared/types at line ${reference.line}`,
        target ?? reference.specifier,
      );
    }

    if (
      startsWithPath(file, "src/types") &&
      (external || !target || !isOneOf(target, foundationPrefixes))
    ) {
      addViolation(
        "foundation/dependency",
        absoluteFile,
        `type contracts may only depend on core/shared/types at line ${reference.line}`,
        target ?? reference.specifier,
      );
    }

    if (startsWithPath(file, "webview/src")) {
      if (
        external &&
        (reference.specifier === "vscode" || builtins.has(reference.specifier))
      ) {
        addViolation(
          "frontend/host-isolation",
          absoluteFile,
          `frontend cannot import VS Code or Node runtimes at line ${reference.line}`,
          reference.specifier,
        );
      } else if (
        target &&
        startsWithPath(target, "src") &&
        !isOneOf(target, foundationPrefixes)
      ) {
        addViolation(
          "frontend/host-isolation",
          absoluteFile,
          `frontend may only share core/shared/types modules with the host at line ${reference.line}`,
          target,
        );
      }
    }

    if (
      isOneOf(file, infrastructurePrefixes) &&
      target &&
      isOneOf(target, outwardPrefixes)
    ) {
      addViolation(
        "infrastructure/direction",
        absoluteFile,
        `infrastructure cannot depend on application or interface adapters at line ${reference.line}`,
        target,
      );
    }

    if (
      (reference.specifier === "child_process" ||
        reference.specifier === "node:child_process") &&
      file !== "src/services/git/exec.ts"
    ) {
      addViolation(
        "runtime/process-boundary",
        absoluteFile,
        `Git subprocesses must go through src/services/git/exec.ts (line ${reference.line})`,
        reference.specifier,
      );
    }
  }
}

// Playwright transpiles E2E TypeScript at runtime, so it is not covered by the
// host tsconfig. Resolve its local imports here to catch stale moves before a
// browser job starts.
for (const absoluteFile of e2eFiles) {
  const { references } = readReferences(absoluteFile);
  for (const reference of references) {
    const resolved = resolveLocalImport(absoluteFile, reference.specifier);
    if (resolved.kind === "unresolved") {
      addViolation(
        "e2e/imports-unresolved",
        absoluteFile,
        `cannot resolve E2E local import at line ${reference.line}`,
        reference.specifier,
      );
    }
  }
}

let nextIndex = 0;
const indexes = new Map();
const lowLinks = new Map();
const stack = [];
const onStack = new Set();

function findStronglyConnectedComponents(file) {
  indexes.set(file, nextIndex);
  lowLinks.set(file, nextIndex);
  nextIndex++;
  stack.push(file);
  onStack.add(file);

  for (const dependency of graph.get(file)) {
    if (!indexes.has(dependency)) {
      findStronglyConnectedComponents(dependency);
      lowLinks.set(
        file,
        Math.min(lowLinks.get(file), lowLinks.get(dependency)),
      );
    } else if (onStack.has(dependency)) {
      lowLinks.set(file, Math.min(lowLinks.get(file), indexes.get(dependency)));
    }
  }

  if (lowLinks.get(file) !== indexes.get(file)) {
    return;
  }
  const component = [];
  let member;
  do {
    member = stack.pop();
    onStack.delete(member);
    component.push(member);
  } while (member !== file);

  const selfCycle = component.length === 1 && graph.get(file).has(file);
  if (component.length > 1 || selfCycle) {
    const members = component.map(repoPath).sort();
    addViolation(
      "graph/cycle",
      members[0],
      `circular dependency component: ${members.join(" -> ")}`,
      members.join(","),
    );
  }
}

for (const file of files) {
  if (!indexes.has(file)) {
    findStronglyConnectedComponents(file);
  }
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

const exceptionPolicy = JSON.parse(fs.readFileSync(exceptionFile, "utf8"));
const exceptions = Array.isArray(exceptionPolicy.exceptions)
  ? exceptionPolicy.exceptions
  : [];
const exceptionErrors = [];
const exceptionIds = new Set();
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

if (exceptionPolicy.version !== 1) {
  exceptionErrors.push("quality exception policy must use version 1");
}
for (const exception of exceptions) {
  const label = exception?.id ?? "<missing id>";
  if (
    typeof exception?.id !== "string" ||
    !/^[a-z0-9][a-z0-9-]+$/.test(exception.id)
  ) {
    exceptionErrors.push(`${label}: id must be lowercase kebab-case`);
  } else if (exceptionIds.has(exception.id)) {
    exceptionErrors.push(`${label}: duplicate id`);
  } else {
    exceptionIds.add(exception.id);
  }
  if (
    typeof exception?.rule !== "string" ||
    typeof exception?.file !== "string"
  ) {
    exceptionErrors.push(`${label}: rule and file are required`);
  }
  if (
    typeof exception?.owner !== "string" ||
    exception.owner.trim().length < 2
  ) {
    exceptionErrors.push(`${label}: owner is required`);
  }
  if (
    typeof exception?.reason !== "string" ||
    exception.reason.trim().length < 20
  ) {
    exceptionErrors.push(
      `${label}: reason must explain the architectural trade-off`,
    );
  }
  const createdOn = parseDate(exception?.createdOn);
  const expiresOn = parseDate(exception?.expiresOn);
  if (!createdOn || !expiresOn) {
    exceptionErrors.push(
      `${label}: createdOn and expiresOn must use YYYY-MM-DD`,
    );
  } else {
    const durationDays =
      (expiresOn.valueOf() - createdOn.valueOf()) / 86_400_000;
    if (durationDays < 1 || durationDays > 90) {
      exceptionErrors.push(`${label}: exceptions must expire within 1-90 days`);
    }
    if (expiresOn <= today) {
      exceptionErrors.push(
        `${label}: exception expired on ${exception.expiresOn}`,
      );
    }
  }
}

const usedExceptions = new Set();
const unsuppressed = violations.filter((violation) => {
  const exception = exceptions.find(
    (candidate) =>
      candidate.rule === violation.rule &&
      candidate.file === violation.file &&
      (candidate.dependency === undefined ||
        candidate.dependency === violation.dependency),
  );
  if (exception) {
    usedExceptions.add(exception.id);
    return false;
  }
  return true;
});
for (const exception of exceptions) {
  if (!usedExceptions.has(exception.id)) {
    exceptionErrors.push(
      `${exception.id}: exception is stale or does not match a violation`,
    );
  }
}

if (exceptionErrors.length > 0 || unsuppressed.length > 0) {
  console.error("Architecture quality gate failed:");
  for (const error of exceptionErrors) {
    console.error(`  - [exceptions/policy] ${error}`);
  }
  for (const violation of unsuppressed) {
    const dependency = violation.dependency
      ? ` (dependency: ${violation.dependency})`
      : "";
    console.error(
      `  - [${violation.rule}] ${violation.file}: ${violation.message}${dependency}`,
    );
  }
  process.exit(1);
}

console.log(
  `Architecture invariants OK (${files.length} production modules, ${e2eFiles.length} E2E modules checked, ${internalDependencyCount} internal dependencies, ${exceptions.length} active exceptions).`,
);
