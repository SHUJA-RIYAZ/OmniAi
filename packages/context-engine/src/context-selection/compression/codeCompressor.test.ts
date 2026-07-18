import { describe, expect, it } from "vitest";
import { CodeCompressor, collapseCollections, shortenLongLiterals } from "./codeCompressor";

const compressor = new CodeCompressor();

describe("CodeCompressor", () => {
  it("returns source unchanged at level none", () => {
    const src = "# comment\n\n\n\nx = 1   \n";
    expect(compressor.compress(src, "python", "none")).toBe(src);
  });

  it("light: trims trailing whitespace and collapses blank runs, keeps comments", () => {
    const src = "x = 1   \n\n\n\ny = 2\n# keep me";
    const out = compressor.compress(src, "python", "light");
    expect(out).toBe("x = 1\n\ny = 2\n# keep me");
  });

  it("aggressive: removes full-line and safe inline comments", () => {
    const src = "# header\nx = 1  # inline\nurl = 'http://x#y'  # has quote, kept\n";
    const out = compressor.compress(src, "python", "aggressive");
    expect(out).not.toContain("# header");
    expect(out).toContain("x = 1");
    expect(out).not.toContain("# inline");
    // Lines containing quotes are left alone to avoid corrupting strings.
    expect(out).toContain("url = 'http://x#y'  # has quote, kept");
  });

  it("aggressive respects removeComments=false", () => {
    const src = "# stays\nx = 1\n";
    const out = compressor.compress(src, "python", "aggressive", { removeComments: false });
    expect(out).toContain("# stays");
  });

  it("dedupes identical import lines", () => {
    const src = "import os\nimport os\nfrom a import b\nfrom a import b\nx = b\n";
    const out = compressor.compress(src, "python", "light");
    expect(out.match(/import os/g)).toHaveLength(1);
    expect(out.match(/from a import b/g)).toHaveLength(1);
  });

  it("aggressive: prunes unused names from from-imports", () => {
    const src = "from typing import List, Optional, Dict\n\nx: List[int] = []\n";
    const out = compressor.compress(src, "python", "aggressive");
    expect(out).toContain("from typing import List");
    expect(out).not.toContain("Optional");
    expect(out).not.toContain("Dict");
  });

  it("aggressive: drops a from-import entirely when nothing is used", () => {
    const src = "from unused import thing\n\nx = 1\n";
    const out = compressor.compress(src, "python", "aggressive");
    expect(out).not.toContain("unused");
  });
});

describe("shortenLongLiterals", () => {
  it("shortens long quoted strings, keeping head and tail", () => {
    const long = "a".repeat(150);
    const out = shortenLongLiterals(`x = "${long}"`);
    expect(out).toContain("…");
    expect(out.length).toBeLessThan(80);
  });

  it("leaves short literals alone", () => {
    const line = `x = "short string"`;
    expect(shortenLongLiterals(line)).toBe(line);
  });
});

describe("collapseCollections", () => {
  it("collapses collections spanning many lines", () => {
    const lines = ["DATA = {", ...Array.from({ length: 20 }, (_, i) => `    'k${i}': ${i},`), "}"];
    const out = collapseCollections(lines);
    expect(out).toHaveLength(3);
    expect(out[1]).toContain("20 lines collapsed");
    expect(out[0]).toBe("DATA = {");
    expect(out[2]).toBe("}");
  });

  it("leaves short collections alone", () => {
    const lines = ["DATA = {", "    'a': 1,", "}"];
    expect(collapseCollections(lines)).toEqual(lines);
  });

  it("ignores brackets inside strings", () => {
    const lines = [`x = "has [ bracket"`, "y = 2"];
    expect(collapseCollections(lines)).toEqual(lines);
  });
});
