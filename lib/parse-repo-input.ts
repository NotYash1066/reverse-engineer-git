import { RepoReference } from "@/lib/types";

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

export function parseRepoInput(input: string): RepoReference {
  const value = input.trim();

  if (!value) {
    throw new Error("Enter a GitHub repository URL or owner/repo.");
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(value)) {
    return buildReference(value.split("/")[0], value.split("/")[1]);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Use a valid GitHub repository URL or owner/repo.");
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Only github.com repository links are supported.");
  }

  const segments = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);

  if (segments.length < 2) {
    throw new Error("Repository links must look like github.com/owner/repo.");
  }

  return buildReference(segments[0], segments[1]);
}

function buildReference(owner: string, repo: string): RepoReference {
  if (!owner || !repo) {
    throw new Error("Use the format owner/repo.");
  }

  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();

  if (!normalizedOwner || !normalizedRepo) {
    throw new Error("Use the format owner/repo.");
  }

  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
    normalized: `${normalizedOwner}/${normalizedRepo}`,
    url: `https://github.com/${normalizedOwner}/${normalizedRepo}`,
  };
}
