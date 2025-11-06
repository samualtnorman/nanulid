#!/usr/bin/env -S node --experimental-strip-types
import { mkdirSync as makeDirectorySync, writeFileSync } from "fs"
import packageJson from "../package.json" with { type: "json" }

const { version, license, dependencies } = packageJson

makeDirectorySync("dist", { recursive: true })

const imports = Object.fromEntries(Object.entries(dependencies).map(
	([ name, version ]) => [ name, `jsr:${name}@${version.slice(4)}` ]
))

writeFileSync("dist/jsr.json", JSON.stringify(
	{ name: `@sn/nanulid`, version, license, exports: { ".": "./default.js" }, imports },
	undefined,
	"\t"
))

process.exit()
