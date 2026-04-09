import { RepoShape } from "@/lib/types";

const DISCOVERY_PATTERNS = [
  /^pnpm-workspace\.yaml$/,
  /^README(\.[a-z0-9]+)?$/i,
  /^package\.json$/,
  /^(apps|packages|services)\/[^/]+\/package\.json$/,
  /^(apps|packages|services)\/[^/]+\/(tsconfig\.json|pyproject\.toml|Cargo\.toml|go\.mod)$/,
];

function scoreDiscoveryPath(path: string): number {
  if (path === "pnpm-workspace.yaml") return 120;
  if (/^README/i.test(path)) return 110;
  if (path === "package.json") return 100;
  if (/^(apps|packages|services)\/[^/]+\/package\.json$/.test(path)) return 90;
  return 40;
}

export function planDiscoveryPaths(allPaths: string[]): string[] {
  return allPaths
    .filter((path) => DISCOVERY_PATTERNS.some((pattern) => pattern.test(path)))
    .sort((left, right) => scoreDiscoveryPath(right) - scoreDiscoveryPath(left) || left.localeCompare(right))
    .slice(0, 18);
}

export function planTargetedPaths(input: {
  allPaths: string[];
  shape: RepoShape;
  alreadyFetched: string[];
  requestedPaths: string[];
}): string[] {
  const fetched = new Set(input.alreadyFetched);
  const ordered = new Set<string>();
  const directFileRequests = input.requestedPaths.filter((requestedPath) =>
    input.allPaths.includes(requestedPath)
  );
  const folderRequests = input.requestedPaths.filter(
    (requestedPath) => !input.allPaths.includes(requestedPath)
  );

  for (const requestedPath of directFileRequests) {
    if (fetched.has(requestedPath)) continue;
    ordered.add(requestedPath);
    fetched.add(requestedPath);
  }

  for (const requestedPath of folderRequests) {
    const prefix = requestedPath.endsWith("/") ? requestedPath : `${requestedPath}/`;
    for (const path of input.allPaths) {
      if (!path.startsWith(prefix) || fetched.has(path)) continue;
      if (/package\.json$|tsconfig\.json$|page\.tsx$|index\.ts$/.test(path)) {
        ordered.add(path);
        fetched.add(path);
      }
    }
  }

  for (const root of input.shape.roots) {
    for (const path of input.allPaths) {
      if (!path.startsWith(root.path) || fetched.has(path)) continue;
      if (/package\.json$|page\.tsx$|index\.ts$/.test(path)) {
        ordered.add(path);
        fetched.add(path);
        break;
      }
    }
  }

  return [...ordered].slice(0, 12);
}
