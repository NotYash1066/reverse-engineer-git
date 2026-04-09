import { parseRepoInput } from "@/lib/parse-repo-input";
import { planDiscoveryPaths } from "@/lib/retrieval-planner";
import { RepoFile, RepoMetadata, RepoSnapshot } from "@/lib/types";

const USER_AGENT = "reverse-engineer-git";
const MAX_FILE_BYTES = 120_000;

type TreeEntry = {
  path: string;
  type: string;
  size?: number;
};

type BranchResponse = {
  commit: {
    commit: {
      tree: {
        sha: string;
      };
    };
  };
};

type ContentEntry = {
  path: string;
  type: string;
  size?: number;
  download_url?: string | null;
};

type GitTreeResponse = {
  tree?: TreeEntry[];
};

export async function fetchRepoSnapshot(input: string): Promise<RepoSnapshot> {
  const repo = parseRepoInput(input);
  const metadata = await githubRequest<RepoMetadata>(`/repos/${repo.owner}/${repo.repo}`);

  if (metadata.private) {
    throw new Error("Only public GitHub repositories are supported.");
  }

  const rootEntries = await fetchRootEntries(repo.owner, repo.repo);
  const allPaths = await fetchRepoTree(repo.owner, repo.repo, metadata.default_branch).catch(() =>
    rootEntries.map((entry) => entry.path)
  );
  const selectedPaths = selectInitialContextPaths(allPaths);
  const files = await fetchRepoFiles(metadata.full_name, selectedPaths);

  return {
    repo: metadata,
    rootEntries: rootEntries.map((entry) => entry.path),
    allPaths,
    files,
  };
}

export function selectInitialContextPaths(allPaths: string[]): string[] {
  return planDiscoveryPaths(allPaths);
}

export async function fetchRepoFiles(fullName: string, paths: string[]): Promise<RepoFile[]> {
  const [owner, repo] = fullName.split("/");
  const files = await Promise.all(paths.map((path) => fetchTextFile(owner, repo, path)));
  return files.filter((file): file is RepoFile => file !== null);
}

async function fetchRootEntries(owner: string, repo: string): Promise<ContentEntry[]> {
  const data = await githubRequest<ContentEntry[]>(`/repos/${owner}/${repo}/contents`);
  return Array.isArray(data) ? data : [];
}

async function fetchRepoTree(owner: string, repo: string, branch: string): Promise<string[]> {
  const branchData = await githubRequest<BranchResponse>(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  const treeSha = branchData.commit.commit.tree.sha;
  const treeData = await githubRequest<GitTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
  );

  return (treeData.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path);
}

async function fetchTextFile(owner: string, repo: string, path: string): Promise<RepoFile | null> {
  const content = await githubRequest<ContentEntry>(`/repos/${owner}/${repo}/contents/${encodePath(path)}`);

  if (content.type !== "file") {
    return null;
  }

  if ((content.size ?? 0) > MAX_FILE_BYTES || !content.download_url) {
    return null;
  }

  const response = await fetch(content.download_url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/plain",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return {
    path,
    size: content.size ?? 0,
    content: await response.text(),
  };
}

async function githubRequest<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Repository not found, or the repository is not public.");
  }

  if (response.status === 403) {
    throw new Error("GitHub API rate limit reached. Try again later or configure GITHUB_TOKEN.");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch repository data from GitHub.");
  }

  return (await response.json()) as T;
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
