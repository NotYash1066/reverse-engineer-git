import { AnalysisContextRequest, RepoFile } from "@/lib/types";

const MAX_FOLDER_EXPANSION = 6;

export function selectRequestedPaths(
  allPaths: string[],
  requests: AnalysisContextRequest[],
  alreadyFetched: string[]
): string[] {
  const allPathSet = new Set(allPaths);
  const fetchedSet = new Set(alreadyFetched);
  const nextPaths: string[] = [];

  for (const request of [...requests].sort((left, right) => right.priority - left.priority)) {
    if (request.kind === "file") {
      if (allPathSet.has(request.path) && !fetchedSet.has(request.path)) {
        nextPaths.push(request.path);
        fetchedSet.add(request.path);
      }
      continue;
    }

    const normalizedPrefix = request.path.endsWith("/") ? request.path : `${request.path}/`;
    const matches = allPaths
      .filter((path) => path.startsWith(normalizedPrefix))
      .filter((path) => !fetchedSet.has(path))
      .slice(0, MAX_FOLDER_EXPANSION);

    for (const match of matches) {
      nextPaths.push(match);
      fetchedSet.add(match);
    }
  }

  return nextPaths;
}

export function measureFiles(files: RepoFile[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}
