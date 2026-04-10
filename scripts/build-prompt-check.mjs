import assert from "node:assert/strict";
import { buildPrompt } from "../.tmp-build/lib/build-prompt.js";

const analysis = {
  repo: {
    fullName: "NotYash1066/Skill-Swap",
    url: "https://github.com/NotYash1066/Skill-Swap",
    description: "A real-time skill swapping platform.",
  },
  stack: ["JavaScript", "React", "Express", "MongoDB", "Socket.io", "WebRTC"],
  appType: "Web application",
  keyFeatures: [
    "authentication and profile management",
    "skill matching and advanced search",
    "real-time chat and video collaboration",
  ],
  architectureNotes: [
    "Use a React frontend with a Node.js/Express backend.",
    "Use MongoDB for persistence and Socket.io/WebRTC for real-time communication.",
    "Keep Docker-based local development and deployment support.",
  ],
  evidence: ["README.md", "client/package.json", "server/package.json"],
  assumptions: ["Redis supports caching or session-style real-time coordination."],
};

const prompt = buildPrompt(analysis);

assert.match(prompt, /^Build a project inspired by NotYash1066\/Skill-Swap/);
assert.ok(prompt.includes("\nProject brief\n"));
assert.ok(prompt.includes("\nWhat to build\n"));
assert.ok(prompt.includes("\nTechnical direction\n"));
assert.ok(prompt.includes("\nImplementation priorities\n"));
assert.ok(prompt.includes("\nAssumptions\n"));

assert.doesNotMatch(prompt, /Repository context:/);
assert.doesNotMatch(prompt, /Observed evidence from the public repository:/);
assert.doesNotMatch(prompt, /Output format:/);

console.log("Prompt brief assertions passed.");
