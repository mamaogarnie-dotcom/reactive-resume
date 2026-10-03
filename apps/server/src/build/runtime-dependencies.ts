import { builtinModules } from "node:module";
import { isAbsolute } from "node:path";

// The server bundle inlines workspace packages but leaves third-party imports external, resolved at
// runtime from `apps/server/dist`. The production image installs only `apps/server` production
// dependencies, so a package that a bundled workspace package declares but `apps/server` does not
// resolves locally (pnpm workspace links, root devDependencies) and fails in production with
// ERR_MODULE_NOT_FOUND.

const builtins: ReadonlySet<string> = new Set(builtinModules);

/** `@scope/name/sub/path` → `@scope/name`, `name/sub/path` → `name`. */
export function packageNameFromSpecifier(specifier: string): string {
	const segments = specifier.split("/");
	return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : (segments[0] as string);
}

function isPackageSpecifier(specifier: string): boolean {
	if (specifier.startsWith(".") || specifier.startsWith("#") || specifier.startsWith("\0")) return false;
	if (specifier.startsWith("node:") || specifier.startsWith("data:") || specifier.startsWith("file:")) return false;
	if (isAbsolute(specifier) || /^[A-Za-z]:[\\/]/.test(specifier)) return false;
	return !builtins.has(packageNameFromSpecifier(specifier));
}

/** Packages imported by the bundle output that are not declared as `apps/server` runtime dependencies. */
export function findUndeclaredExternals(
	specifiers: Iterable<string>,
	declaredDependencies: Iterable<string>,
): string[] {
	const declared = new Set(declaredDependencies);
	const undeclared = new Set<string>();

	for (const specifier of specifiers) {
		if (!isPackageSpecifier(specifier)) continue;
		const name = packageNameFromSpecifier(specifier);
		if (!declared.has(name)) undeclared.add(name);
	}

	return [...undeclared].sort();
}
