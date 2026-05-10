/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: false },
          transform: { react: { runtime: "automatic" } },
          target: "es2020",
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(comlink)/)"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/out/"],
};
