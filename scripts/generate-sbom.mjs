#!/usr/bin/env node
/**
 * generate-sbom.mjs — CycloneDX Software Bill of Materials (SBOM) generator
 *
 * Scans package.json and package-lock.json to generate a specification-compliant
 * CycloneDX v1.5 SBOM JSON document at build/sbom.json for supply chain transparency.
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function main() {
  const pkgPath = join(rootDir, 'package.json')
  const lockPath = join(rootDir, 'package-lock.json')
  const outDir = join(rootDir, 'build')
  const outPath = join(outDir, 'sbom.json')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  let lock = { packages: {} }
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
  } catch {
    console.warn(
      '[sbom] package-lock.json not found or unreadable, using package.json dependencies only.'
    )
  }

  const components = []
  const seen = new Set()

  // Iterate over lockfile packages (npm v7+ package-lock format)
  if (lock.packages) {
    for (const [pkgKey, pkgInfo] of Object.entries(lock.packages)) {
      if (!pkgKey || pkgKey === '') continue // root package
      const name = pkgInfo.name || pkgKey.replace(/^node_modules\//, '')
      const version = pkgInfo.version
      if (!name || !version) continue

      const componentKey = `${name}@${version}`
      if (seen.has(componentKey)) continue
      seen.add(componentKey)

      const component = {
        type: 'library',
        name,
        version,
        purl: `pkg:npm/${name.startsWith('@') ? name.replace('/', '%2F') : name}@${version}`,
        scope: pkgInfo.dev ? 'optional' : 'required'
      }

      if (pkgInfo.license) {
        component.licenses = [{ license: { id: pkgInfo.license } }]
      }

      if (pkgInfo.integrity) {
        const [algPrefix, hashValue] = pkgInfo.integrity.split('-')
        const alg = algPrefix.toUpperCase().replace('SHA', 'SHA-')
        component.hashes = [{ alg: alg || 'SHA-512', content: hashValue }]
      }

      components.push(component)
    }
  }

  // If lockfile was empty, fall back to package.json dependencies
  if (components.length === 0) {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    for (const [name, version] of Object.entries(allDeps)) {
      const cleanVer = String(version).replace(/^[^0-9]*/, '')
      components.push({
        type: 'library',
        name,
        version: cleanVer || '0.0.0',
        purl: `pkg:npm/${name}@${cleanVer || '0.0.0'}`
      })
    }
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'Pulse',
          name: 'pulse-sbom-generator',
          version: pkg.version
        }
      ],
      component: {
        type: 'application',
        name: pkg.name || 'pulse',
        version: pkg.version,
        description: pkg.description || 'Pulse Download Manager',
        licenses: [{ license: { id: pkg.license || 'MIT' } }]
      }
    },
    components
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outPath, JSON.stringify(sbom, null, 2), 'utf-8')
  console.info(`[sbom] Generated CycloneDX SBOM with ${components.length} components at ${outPath}`)
}

main()
