import { RepoShape, RepoShapeRoot, RepoSnapshot } from "@/lib/types";

function makeRoot(path: string, kind: RepoShapeRoot["kind"], reason: string): RepoShapeRoot {
  return { path, kind, reason };
}

export function classifyRepoShape(snapshot: RepoSnapshot): RepoShape {
  const pathSet = new Set(snapshot.allPaths);
  const roots: RepoShapeRoot[] = [];
  const signals: string[] = [];
  const seenRoots = new Set<string>();

  if (pathSet.has("pnpm-workspace.yaml")) {
    signals.push("workspace manifest");
  }

  for (const path of snapshot.allPaths) {
    const packageMatch = path.match(/^(apps|packages|services)\/([^/]+)\/package\.json$/);
    if (packageMatch) {
      const [, bucket, name] = packageMatch;
      const rootPath = `${bucket}/${name}`;
      if (!seenRoots.has(rootPath)) {
        const kind = bucket === "services" ? "service" : bucket === "packages" ? "package" : "app";
        roots.push(makeRoot(rootPath, kind, `${bucket} package manifest`));
        seenRoots.add(rootPath);
      }
      continue;
    }

    const workspaceMatch = path.match(/^(apps|packages|services)\/([^/]+)\//);
    if (workspaceMatch) {
      const [, bucket, name] = workspaceMatch;
      const rootPath = `${bucket}/${name}`;
      if (!seenRoots.has(rootPath)) {
        const kind = bucket === "services" ? "service" : bucket === "packages" ? "package" : "app";
        roots.push(makeRoot(rootPath, kind, `${bucket} workspace path`));
        seenRoots.add(rootPath);
      }
    }
  }

  if (roots.length > 1 || pathSet.has("pnpm-workspace.yaml")) {
    return {
      kind: "monorepo",
      roots,
      signals: [...signals, `${roots.length} package roots`],
      ambiguous: roots.length === 0,
    };
  }

  if (pathSet.has("package.json") && (pathSet.has("next.config.ts") || pathSet.has("app/page.tsx"))) {
    return {
      kind: "single-app",
      roots: [makeRoot(".", "app", "root app manifests")],
      signals: ["root package.json", "root web app signals"],
      ambiguous: false,
    };
  }

  if (pathSet.has("Cargo.toml") && (pathSet.has("frontend/package.json") || pathSet.has("backend/package.json"))) {
    return {
      kind: "mixed",
      roots: [
        makeRoot("frontend", "app", "frontend package manifest"),
        makeRoot("backend", "service", "backend package manifest"),
      ],
      signals: ["multiple stack roots"],
      ambiguous: true,
    };
  }

  return {
    kind: "service",
    roots: [makeRoot(".", "service", "default repository root")],
    signals: ["fallback classification"],
    ambiguous: true,
  };
}
