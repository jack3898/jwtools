import { describe, expect, it } from "vitest";
import { EnvDocument } from "./env-document";

describe("EnvDocument.toString()", () => {
  describe("round-trip invariants", () => {
    it("should read and parse an env file and stringify it", () => {
      const input = `
# This is a comment
            KEY1=VALUE1

KEY2='VALUE2'      # Inline comment
# Dedicated comment
`;

      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should be idempotent across multiple parse/stringify rounds", () => {
      const input = `
# This is a comment
            KEY1=VALUE1

KEY2='VALUE2'      # Inline comment
# Dedicated comment
`;

      let document = new EnvDocument(input);
      const first = document.toString();

      document = new EnvDocument(first);
      const second = document.toString();

      document = new EnvDocument(second);
      const third = document.toString();

      expect(third).toBe(first);
    });
  });

  describe("whitespace preservation", () => {
    it("should preserve leading whitespace before keys", () => {
      const input = `    KEY=VALUE`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve trailing whitespace after values", () => {
      const input = `KEY=VALUE    `;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve blank lines exactly", () => {
      const input = `

KEY=VALUE


ANOTHER=VAL

`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });
  });

  describe("comment handling", () => {
    it("should preserve standalone comment lines exactly", () => {
      const input = `#comment
# comment with space
    # indented comment
`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve inline comments spacing and content", () => {
      const input = `KEY=VALUE # inline comment
KEY2=VALUE2    #    spaced comment
`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve comments containing quotes and special characters", () => {
      const input = `KEY=VALUE # "quoted" 'comment' #!@$%^&*()
`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });
  });

  describe("quoted values", () => {
    it("should preserve double-quoted values exactly", () => {
      const input = `KEY="VALUE WITH SPACES"`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve single-quoted values exactly", () => {
      const input = `KEY='VALUE WITH SPACES'`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve values containing # when not comments", () => {
      const input = `URL=https://example.com/path#section`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });
  });

  describe("newline handling", () => {
    it("should preserve absence of trailing newline", () => {
      const input = `KEY=VALUE`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });

    it("should preserve presence of trailing newline", () => {
      const input = `KEY=VALUE\n`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });
  });

  describe("real-world examples", () => {
    it("should round-trip a realistic env file without modification", () => {
      const input = `# App config
NODE_ENV=development

# Database
DATABASE_URL="postgres://user:pass@localhost:5432/db"

# Feature flags
FEATURE_X=true   # temporary
FEATURE_Y=false

`;
      const document = new EnvDocument(input);

      expect(document.toString()).toBe(input);
    });
  });
});
