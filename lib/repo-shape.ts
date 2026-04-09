import { RepoShape, RepoShapeRoot, RepoSnapshot } from "@/lib/types";

function makeRoot(path: string, kind: RepoShapeRoot["kind"], reason: string): RepoShapeRoot {
  return { path, kind, reason };
}

export function classifyRepoShape(snapshot: RepoSnapshot): RepoShape {
  const pathSet = new Set(snapshot.allPaths);
  const roots: RepoShapeRoot[] = [];
  const signals: string[] = [];

  if (pathSet.has("pnpm-workspace.yaml")) {
    signals.push("workspace manifest");
  }

  for (const path of snapshot.allPaths) {
    const match = path.match(/^(apps|packages|services)\/([^/]+)\/package\.json$/);
    if (match) {
      const [, bucket, name] = match;
      const kind = bucket === "services" ? "service" : bucket === "packages" ? "package" : "app";
      roots.push(makeRoot(`${bucket}/${name}`, kind, `${bucket} package manifest`));
    }
  }

  if (roots.length > 1 || pathSet.has("pnpm-workspace.yaml")) {
    return {
      kind: "monorepo",
      roots,
      signals: [...signals, `${roots.length} package roots`],
      ambiguous: false,
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
