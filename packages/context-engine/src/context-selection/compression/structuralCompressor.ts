import type { ArgumentInfo, FileAnalysis, FunctionInfo } from "@ai-context-bridge/shared";
import type { IStructuralCompressor } from "../interfaces";

/**
 * Structural compression (Feature 6): renders a file as a signature-level
 * skeleton — imports, classes with inheritance/properties/method
 * signatures, function signatures, first docstring lines — instead of
 * full source. Deterministic, order-preserving (analysis order = source
 * order).
 */
export class StructuralCompressor implements IStructuralCompressor {
  render(filePath: string, analysis: FileAnalysis): string {
    const lines: string[] = [`# ${filePath} — structural summary`];

    if (analysis.imports.length > 0) {
      const modules = [...new Set(analysis.imports.map((i) => i.module || "."))];
      lines.push(`# imports: ${modules.join(", ")}`);
    }

    for (const fn of analysis.functions) {
      lines.push(...renderFunction(fn, ""));
    }

    for (const cls of analysis.classes) {
      const bases = cls.baseClasses.length > 0 ? `(${cls.baseClasses.join(", ")})` : "";
      lines.push("", `class ${cls.name}${bases}:`);
      if (cls.docstring) lines.push(`    """${firstLine(cls.docstring)}"""`);
      for (const prop of cls.properties) {
        lines.push(`    ${prop.name}${prop.type ? `: ${prop.type}` : ""}`);
      }
      for (const method of cls.methods) {
        lines.push(...renderFunction(method, "    "));
      }
      if (!cls.docstring && cls.properties.length === 0 && cls.methods.length === 0) {
        lines.push("    ...");
      }
    }

    return lines.join("\n");
  }
}

function renderFunction(fn: FunctionInfo, indent: string): string[] {
  const args = fn.args.map(renderArg).join(", ");
  const ret = fn.returnType ? ` -> ${fn.returnType}` : "";
  const decorators = fn.decorators.map((d) => `${indent}@${d}`);
  const lines = [...decorators, `${indent}def ${fn.name}(${args})${ret}: ...`];
  if (fn.docstring) {
    lines.splice(decorators.length, 0, "");
    lines.push(`${indent}    """${firstLine(fn.docstring)}"""`);
    // Keep the `...` marker last for valid-looking stubs.
    const def = lines.indexOf(`${indent}def ${fn.name}(${args})${ret}: ...`);
    lines[def] = `${indent}def ${fn.name}(${args})${ret}:`;
    lines.push(`${indent}    ...`);
  }
  return lines;
}

function renderArg(arg: ArgumentInfo): string {
  let out = arg.name;
  if (arg.type) out += `: ${arg.type}`;
  if (arg.default) out += ` = ${arg.default}`;
  return out;
}

function firstLine(text: string): string {
  return (text.split("\n")[0] as string).trim();
}
