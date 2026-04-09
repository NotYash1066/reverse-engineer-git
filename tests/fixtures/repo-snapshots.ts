import { RepoSnapshot } from "@/lib/types";

export function makeRepoSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    repo: {
      full_name: "acme/example",
      name: "example",
      description: "Example repository",
      private: false,
      html_url: "https://github.com/acme/example",
      default_branch: "main",
      language: "TypeScript",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      topics: [],
      homepage: null,
      license: null,
    },
    rootEntries: [],
    allPaths: [],
    files: [],
    ...overrides,
  };
}
