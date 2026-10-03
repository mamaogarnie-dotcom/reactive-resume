import type { TsdownPlugin } from "tsdown";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
// Explicit `.ts`: tsdown loads this config with Node's native TypeScript support, which needs it.
import { findUndeclaredExternals } from "./src/build/runtime-dependencies.ts";

const rootPackageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8")) as {
	version?: string;
};

const serverPackageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
	dependencies?: Record<string, string>;
};

const shouldExternalizeThirdParty = (id: string) => {
	if (id.startsWith("@reactive-resume/")) return false;
	// `isAbsolute` also covers Windows paths ("E:\\..."); a bare `/` check externalized every resolved
	// workspace file on Windows and produced a bundle that only worked inside the repository.
	if (id.startsWith("@/") || id.startsWith(".") || isAbsolute(id) || id.startsWith("\0")) return false;

	return true;
};

// Fails the build when bundled code imports a package that the production image will not install.
const runtimeDependenciesPlugin: TsdownPlugin = {
	name: "runtime-dependencies",
	generateBundle(_options, bundle) {
		// Chunk imports also list the bundle's own chunk files; only the rest are external specifiers.
		const specifiers = Object.values(bundle)
			.flatMap((output) => (output.type === "chunk" ? [...output.imports, ...output.dynamicImports] : []))
			.filter((specifier) => !(specifier in bundle));
		const undeclared = findUndeclaredExternals(specifiers, Object.keys(serverPackageJson.dependencies ?? {}));

		if (undeclared.length > 0) {
			this.error(
				`Bundled server code imports packages that are not declared in apps/server/package.json dependencies: ${undeclared.join(", ")}. The production image installs only apps/server dependencies, so these fail at runtime with ERR_MODULE_NOT_FOUND.`,
			);
		}
	},
};

const aiPromptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/ai/src/prompts");

const promptAssetsPlugin: TsdownPlugin = {
	name: "prompt-assets",
	buildStart() {
		for (const filename of readdirSync(aiPromptsDir)) {
			if (!filename.endsWith(".md")) continue;

			this.emitFile({
				type: "asset",
				fileName: `prompts/${filename}`,
				source: readFileSync(resolve(aiPromptsDir, filename), "utf-8"),
			});
		}
	},
};

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: "esm",
	platform: "node",
	target: "node24",
	outDir: "dist",
	clean: true,
	shims: true,
	dts: false,
	define: { __APP_VERSION__: JSON.stringify(rootPackageJson.version ?? "0.0.0") },
	// The flagged dynamic imports are deliberate: they defer evaluation of env-dependent
	// modules so tests can run without env vars, not to split chunks.
	suppressWarnings: [/dynamic import will not move module into another chunk/],
	outExtensions: () => ({ js: ".mjs" }),
	deps: {
		alwaysBundle: [/^@reactive-resume\//],
		neverBundle: shouldExternalizeThirdParty,
	},
	plugins: [promptAssetsPlugin, runtimeDependenciesPlugin],
});
