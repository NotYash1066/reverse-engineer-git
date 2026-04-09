import { classifyRepoShape } from "@/lib/repo-shape";
import { RepoAnalysis, RepoFile, RepoSnapshot } from "@/lib/types";

export function analyzeRepo(snapshot: RepoSnapshot): RepoAnalysis {
  const repoShape = classifyRepoShape(snapshot);
  const stack = detectStack(snapshot);
  const appType = repoShape.kind === "monorepo" ? "Monorepo software project" : detectAppType(snapshot);
  const keyFeatures = detectKeyFeatures(snapshot);
  const architectureNotes = [
    `Repository shape classified as ${repoShape.kind}.`,
    ...detectArchitectureNotes(snapshot),
  ];
  const evidence = collectEvidence(snapshot);

  return {
    repo: {
      fullName: snapshot.repo.full_name,
      url: snapshot.repo.html_url,
      description: snapshot.repo.description,
    },
    stack,
    appType,
    keyFeatures,
    architectureNotes,
    evidence,
  };
}

function detectStack(snapshot: RepoSnapshot): string[] {
  const stack = new Set<string>();
  const packageNames = getPackageNamesAcrossFiles(snapshot.files);
  const pathSet = new Set(snapshot.allPaths);

  if (snapshot.repo.language) {
    stack.add(snapshot.repo.language);
  }

  if (pathSet.has("package.json") || hasPathSuffix(snapshot.allPaths, "/package.json")) {
    stack.add("Node.js");
    stack.add("JavaScript/TypeScript ecosystem");
  }

  if (pathSet.has("tsconfig.json") || hasPathSuffix(snapshot.allPaths, "/tsconfig.json")) {
    stack.add("TypeScript");
  }

  if (packageNames.has("next")) stack.add("Next.js");
  if (packageNames.has("react")) stack.add("React");
  if (packageNames.has("vue")) stack.add("Vue");
  if (packageNames.has("svelte")) stack.add("Svelte");
  if (packageNames.has("astro")) stack.add("Astro");
  if (packageNames.has("express")) stack.add("Express");
  if (packageNames.has("fastify")) stack.add("Fastify");
  if (packageNames.has("koa")) stack.add("Koa");
  if (packageNames.has("hono")) stack.add("Hono");
  if (packageNames.has("@nestjs/core") || packageNames.has("@nestjs/common")) stack.add("NestJS");
  if (packageNames.has("tailwindcss")) stack.add("Tailwind CSS");
  if (packageNames.has("electron")) stack.add("Electron");
  if (packageNames.has("react-native")) stack.add("React Native");

  if (pathSet.has("requirements.txt") || pathSet.has("pyproject.toml") || hasPathSuffix(snapshot.allPaths, "/pyproject.toml")) {
    stack.add("Python");
  }

  if (pathSet.has("go.mod") || hasPathSuffix(snapshot.allPaths, "/go.mod")) {
    stack.add("Go");
  }

  if (pathSet.has("Cargo.toml") || hasPathSuffix(snapshot.allPaths, "/Cargo.toml")) {
    stack.add("Rust");
  }

  if (pathSet.has("pom.xml") || pathSet.has("build.gradle")) {
    stack.add("Java");
  }

  if (pathSet.has("Dockerfile") || pathSet.has("docker-compose.yml") || pathSet.has("docker-compose.yaml")) {
    stack.add("Docker");
  }

  return Array.from(stack);
}

function detectAppType(snapshot: RepoSnapshot): string {
  const readme = getCombinedReadme(snapshot.files);
  const packageNames = getPackageNamesAcrossFiles(snapshot.files);
  const topics = snapshot.repo.topics.join(" ");
  const frameworkSignal = /framework|compiler|sdk|library|plugin|tooling/i;
  const webSignal = ["next", "react", "vue", "svelte", "astro", "gatsby", "nuxt"].some((name) =>
    packageNames.has(name)
  );
  const backendSignal = ["express", "fastify", "koa", "hono", "@nestjs/core"].some((name) =>
    packageNames.has(name)
  );

  if (/react native|android|ios|expo|mobile/i.test(readme) || packageNames.has("react-native")) {
    return "Mobile application";
  }

  if (packageNames.has("electron") || /desktop app|desktop application|electron/i.test(readme)) {
    return "Desktop application";
  }

  if (frameworkSignal.test(topics) || frameworkSignal.test(readme)) {
    return "Framework or developer platform";
  }

  if (packageNames.has("commander") || packageNames.has("yargs") || /command line/i.test(readme)) {
    return "CLI tool";
  }

  if (webSignal || hasConfigPath(snapshot.allPaths, ["next.config", "vite.config", "astro.config", "svelte.config"])) {
    return "Web application";
  }

  if (backendSignal || /api|backend|server/i.test(readme)) {
    return "API or backend service";
  }

  if (hasMonorepoDirectories(snapshot.allPaths)) {
    return "Monorepo or multi-package project";
  }

  return "Software project";
}

function detectKeyFeatures(snapshot: RepoSnapshot): string[] {
  const featureHints = new Set<string>();
  const combined = `${getCombinedReadme(snapshot.files)}\n${snapshot.files.map((file) => file.content).join("\n")}`;
  const packageNames = getPackageNamesAcrossFiles(snapshot.files);

  if (/auth|login|signup|oauth|session|jwt/i.test(combined)) {
    featureHints.add("User authentication flows");
  }

  if (/dashboard|analytics|chart|report|metrics/i.test(combined)) {
    featureHints.add("Dashboard or analytics views");
  }

  if (/graphql/i.test(combined) || packageNames.has("graphql") || packageNames.has("@apollo/client")) {
    featureHints.add("GraphQL-based API integration");
  } else if (/api|rest|fetch|axios/i.test(combined)) {
    featureHints.add("API integration or service layer");
  }

  if (/database|postgres|mysql|sqlite|mongodb|prisma|drizzle|typeorm|sequelize/i.test(combined)) {
    featureHints.add("Persistent data storage");
  }

  if (packageNames.has("tailwindcss") || packageNames.has("@mui/material") || packageNames.has("@chakra-ui/react")) {
    featureHints.add("Component-based UI system");
  }

  if (/docker|deploy|vercel|netlify|aws|cloud|kubernetes/i.test(combined)) {
    featureHints.add("Deployment-oriented configuration");
  }

  if (/worker|queue|cron|bullmq|scheduler/i.test(combined)) {
    featureHints.add("Background jobs or asynchronous processing");
  }

  if (/websocket|socket\.io|realtime|live/i.test(combined)) {
    featureHints.add("Real-time or live update capabilities");
  }

  if (featureHints.size === 0 && getCombinedReadme(snapshot.files).trim()) {
    featureHints.add("Core behavior likely described in the repository README");
  }

  return Array.from(featureHints);
}

function detectArchitectureNotes(snapshot: RepoSnapshot): string[] {
  const notes = new Set<string>();
  const packageNames = getPackageNamesAcrossFiles(snapshot.files);

  if (snapshot.allPaths.includes("package.json")) {
    notes.add("Repository is organized around a Node.js package manifest.");
  }

  if (snapshot.allPaths.includes("pnpm-workspace.yaml") || hasMonorepoDirectories(snapshot.allPaths)) {
    notes.add("Workspace layout suggests a monorepo or multi-package setup.");
  }

  if (snapshot.allPaths.includes("Dockerfile") || snapshot.allPaths.includes("docker-compose.yml")) {
    notes.add("Containerization is part of the intended development or deployment workflow.");
  }

  if (packageNames.has("turbo")) {
    notes.add("Build orchestration tooling suggests coordinated tasks across multiple packages.");
  }

  if (hasAnyPackage(snapshot.files, ["prisma", "typeorm", "sequelize", "drizzle-orm"])) {
    notes.add("ORM or database tooling is present in the application layer.");
  }

  if (hasAnyPackage(snapshot.files, ["next", "react", "vite", "astro", "vue", "svelte"])) {
    notes.add("Frontend framework configuration is visible from sampled manifests.");
  }

  if (hasAnyPackage(snapshot.files, ["jest", "vitest", "playwright", "cypress"])) {
    notes.add("Automated testing tools are configured in the repository.");
  }

  if (hasWorkflowFiles(snapshot.allPaths)) {
    notes.add("GitHub Actions workflows are present for CI or deployment automation.");
  }

  if (notes.size === 0) {
    notes.add("Only lightweight repository signals were available in the sampled public files.");
  }

  return Array.from(notes);
}

function collectEvidence(snapshot: RepoSnapshot): string[] {
  const evidence = new Set<string>();

  evidence.add(`Default branch: ${snapshot.repo.default_branch}`);

  if (snapshot.repo.language) {
    evidence.add(`Primary GitHub language: ${snapshot.repo.language}`);
  }

  if (snapshot.repo.topics.length > 0) {
    evidence.add(`Topics: ${snapshot.repo.topics.join(", ")}`);
  }

  evidence.add(`Sampled files: ${snapshot.files.length}`);

  for (const file of snapshot.files) {
    evidence.add(`Inspected file: ${file.path}`);
  }

  if (snapshot.repo.license?.name) {
    evidence.add(`License: ${snapshot.repo.license.name}`);
  }

  return Array.from(evidence);
}

function getCombinedReadme(files: RepoFile[]): string {
  return `${readFile(files, "README.md")}\n${readFile(files, "README.mdx")}`;
}

function readFile(files: RepoFile[], path: string): string {
  return files.find((file) => file.path === path)?.content ?? "";
}

function getPackageNamesAcrossFiles(files: RepoFile[]): Set<string> {
  return new Set(files.flatMap((file) => (file.path.endsWith("package.json") ? [...getPackageNames(file.content)] : [])));
}

function getPackageNames(packageJson: string): Set<string> {
  if (!packageJson.trim()) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

function hasAnyPackage(files: RepoFile[], names: string[]): boolean {
  const packageNames = getPackageNamesAcrossFiles(files);
  return names.some((name) => packageNames.has(name));
}

function hasPathSuffix(paths: string[], suffix: string): boolean {
  return paths.some((path) => path.endsWith(suffix));
}

function hasConfigPath(paths: string[], prefixes: string[]): boolean {
  return paths.some((path) => prefixes.some((prefix) => path.startsWith(prefix)));
}

function hasMonorepoDirectories(paths: string[]): boolean {
  return paths.some((path) => /^(apps|packages|services)\//.test(path));
}

function hasWorkflowFiles(paths: string[]): boolean {
  return paths.some((path) => path.startsWith(".github/workflows/"));
}
