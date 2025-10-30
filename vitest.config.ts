import type { ViteUserConfig } from "vitest/config"

export default {
	test: { includeSource: [ "src/**/*.ts" ], benchmark: { includeSource: [ "src/**/*.ts" ] } },
} satisfies ViteUserConfig
