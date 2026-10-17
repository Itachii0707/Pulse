#!/usr/bin/env node
/**
 * sign-windows.mjs — electron-builder afterSign hook
 *
 * Called automatically by electron-builder after packaging, before the NSIS installer is created.
 * Signs every PE binary (exe, dll) inside the unpacked app using signtool.exe with an EV
 * certificate loaded from a hardware token (USB dongle) or a cloud signing service (e.g. DigiCert
 * KeyLocker, SSL.com eSigner).
 *
 * Configuration — set via environment variables in your CI/CD pipeline:
 *
 *   PULSE_SIGN_CERT_SHA1      SHA1 thumbprint of the EV certificate (preferred over /n name match)
 *   PULSE_SIGN_CERT_NAME      Certificate subject name fallback (if SHA1 not set)
 *   PULSE_SIGN_TIMESTAMP_URL  RFC 3161 timestamp server  (default: DigiCert)
 *   PULSE_SIGN_DESCRIPTION    Product description shown in the UAC/SmartScreen dialog
 *   PULSE_SIGN_URL            Product URL shown in the UAC/SmartScreen dialog
 *
 * Skip signing entirely by setting:
 *   PULSE_SKIP_SIGN=1         (useful in PR / draft builds)
 *
 * Getting an EV certificate
 * ─────────────────────────
 *   1. Purchase an Extended Validation (EV) Code Signing certificate from:
 *        • DigiCert  https://www.digicert.com/signing/code-signing-certificates
 *        • Sectigo   https://sectigo.com/ssl-certificates-tls/code-signing
 *        • SSL.com   https://www.ssl.com/certificates/ev-code-signing/
 *   EV certs are hardware-bound: they arrive on a USB HSM token or via a cloud-signing API.
 *   They build "reputation" in Microsoft SmartScreen from the first signed release.
 *
 *   2. Cloud signing (CI-friendly, no USB token required):
 *        • DigiCert KeyLocker — set PKCS#11 env vars, sign with signtool /csp /kc
 *        • SSL.com eSigner    — use esigner-codesign GitHub Action
 *        • Azure Trusted Signing — use TrustedSigning.GitHub.Action
 *
 * signtool.exe location
 * ─────────────────────
 *   Included in the Windows SDK.  Default path used here:
 *     C:\Program Files (x86)\Windows Kits\10\bin\<SDK_ver>\x64\signtool.exe
 *   Override with PULSE_SIGNTOOL_PATH if your SDK is installed elsewhere.
 */

import { execFileSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join, extname } from 'path'

// ─── Configuration ────────────────────────────────────────────────────────────

const SKIP = process.env.PULSE_SKIP_SIGN === '1'

const CERT_SHA1 = process.env.PULSE_SIGN_CERT_SHA1 ?? ''
const CERT_NAME = process.env.PULSE_SIGN_CERT_NAME ?? ''
const TIMESTAMP_URL = process.env.PULSE_SIGN_TIMESTAMP_URL ?? 'http://timestamp.digicert.com'
const DESCRIPTION = process.env.PULSE_SIGN_DESCRIPTION ?? 'Pulse Download Manager'
const PRODUCT_URL = process.env.PULSE_SIGN_URL ?? 'https://pulse.app'

/** Locate signtool.exe — tries the env-var path first, then common SDK locations. */
function findSigntool() {
  if (process.env.PULSE_SIGNTOOL_PATH) return process.env.PULSE_SIGNTOOL_PATH

  const wkitBase = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
  if (!existsSync(wkitBase)) return 'signtool.exe' // hope it's on PATH

  // Pick the highest SDK version available (e.g. 10.0.26100.0)
  const versions = readdirSync(wkitBase)
    .filter((d) => /^\d+\.\d+\.\d+\.\d+$/.test(d))
    .sort()
    .reverse()

  for (const ver of versions) {
    const candidate = join(wkitBase, ver, 'x64', 'signtool.exe')
    if (existsSync(candidate)) return candidate
  }

  return 'signtool.exe'
}

/** Collect all PE binaries that need to be signed. */
function collectBinaries(dir) {
  const SIGN_EXTS = new Set(['.exe', '.dll', '.node'])
  const results = []

  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (SIGN_EXTS.has(extname(entry.name).toLowerCase())) {
        results.push(full)
      }
    }
  }

  walk(dir)
  return results
}

/** Sign a single file using signtool.exe */
function signFile(signtool, file) {
  const args = [
    'sign',
    '/fd',
    'SHA256',
    '/tr',
    TIMESTAMP_URL,
    '/td',
    'SHA256',
    '/d',
    DESCRIPTION,
    '/du',
    PRODUCT_URL
  ]

  if (CERT_SHA1) {
    args.push('/sha1', CERT_SHA1)
  } else {
    args.push('/n', CERT_NAME)
  }

  args.push(file)

  try {
    execFileSync(signtool, args, { stdio: 'inherit' })
    console.log(`  ✓ signed: ${file}`)
  } catch (err) {
    // Treat a signing failure as a hard error so the release pipeline stops.
    throw new Error(`signtool failed for ${file}: ${err.message}`)
  }
}

// ─── electron-builder afterSign hook entry point ─────────────────────────────

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
export default async function sign(context) {
  if (process.platform !== 'win32') return // Only sign on Windows runners
  if (SKIP) {
    console.warn('[pulse:sign] PULSE_SKIP_SIGN=1 — skipping code signing')
    return
  }
  if (!CERT_SHA1 && !CERT_NAME) {
    console.warn('[pulse:sign] No certificate configured — skipping code signing')
    return
  }

  const signtool = findSigntool()
  console.log(`[pulse:sign] Using signtool: ${signtool}`)

  const appOutDir = context.appOutDir
  const binaries = collectBinaries(appOutDir)

  console.log(`[pulse:sign] Signing ${binaries.length} binaries in ${appOutDir} …`)

  for (const file of binaries) {
    signFile(signtool, file)
  }

  console.log(`[pulse:sign] All binaries signed successfully ✓`)
}
