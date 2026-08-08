#!/usr/bin/env node
/**
 * Brand Availability Checker
 *
 * Checks: Domain (.com/.dev/.io via RDAP) + GitHub + X/Twitter + npm
 *
 * Scoring favors .dev/.io + github/npm (a dev tool lives there); .com
 * and x are small bonuses, not gates.
 *
 * Usage: node scripts/check-brand.mjs
 */

import { promises as dns } from "node:dns";
import https from "node:https";

// ── Candidates ─────────────────────────────────────────────────
//  Bar: say it out loud correctly on the first try. Prefer short
//  (≤8, ideally 4–6). No forced git/diff suffix.
//
//  Tier: Cursor / Kiro / Linear / Arc / Warp
//    • real English words used as proper nouns (not product nouns)
//    • short name-like brands that feel intentional (not CVCV soup)
//  Avoid: brand-generator soup, on-the-nose merge metaphors,
//  foreign-language puns, random syllable mash.
//
//  Shortlist ranked by brand feel for a Git merge + workspace tool.
//  Availability is secondary — .dev-only + GH org is acceptable.
const CANDIDATES = [
  // ── Invented compounds (commercial feel, not template spam) ─
  // Inspired by *energy* of ShopBase/Messbox — not the formulas.
  // Product form: CamelCase. Checker slug: lowercase.
  //
  // Place / craft of joining (merge studio)
  "joinery", // craft of joining wood → joining sides
  "bindery", // book bindery → bind versions
  "mergery", // invented “place you merge” (bakery-shaped)
  "splicery",
  "millwork", // precision joinery
  "patchup", // patch things up
  "mergewell", // merge + all’s well
  "sidefold", // fold the sides together
  "workfold",
  "crosspane",
  "twinpane",
  "clearpane",
  "truepane",
  "densepane",
  "panora", // pane + panorama
  "diffine", // diff + refine / define
  "diffinity", // affinity / clarity of diffs
  "difflux", // diff + flux
  "mergelux", // merge + lux (light)
  "panelux",
  "sidelux",
  "amalgine", // amalgamate + engine
  "mergine", // merge + engine
  "diffgate",
  "mergegate",
  "patchgate",
  "sidegate",
  "panegate",
  "changegate",
  "patchlane",
  "difflane",
  "mergelane",
  "stagelane",
  "sidelane",
  "changelane",
  "mergekeep", // keep = stronghold
  "diffkeep",
  "patchkeep",
  "stagekeep",
  "sidekeep",
  "panekeep",
  "workkeep",
  "codekeep",
  "changekeep",
  "diffhaven",
  "mergehaven",
  "stagehaven",
  "patchhaven",
  "sidehaven",
  "panehaven",
  "workhaven",
  "codehaven",
  "changecove",
  "diffcove",
  "mergecove",
  "stagecove",
  "patchcove",
  "sidecove",
  "panecove",
  "workcove",
  "codecove",
  "stageport",
  "diffport",
  "mergeport",
  "patchport",
  "sideport",
  "paneport",
  "workport",
  "codeport",
  "changeport",
  "diffloom", // weave diffs
  "mergeloom",
  "patchloom",
  "sideloom",
  "paneloom",
  "stageloom",
  "sidecraft",
  "panecraft",
  "patchcraft",
  "diffwright",
  "mergewright",
  "patchwright",
  "changewright",
  "diffsmith",
  "mergesmith",
  "patchsmith",
  "stagesmith",
  "sidesmith",
  "faultline", // conflicts as fault lines to close
  "riftline",
  "riftgate",
  "riftkeep",
  "syncline", // geology: folds meeting
  "tricline",
  "versaline", // version line
  "versapane",
  "versafold",
  "versagate",
  "versaport",
  "versakeep",
  "versahaven",
  "versalane",
  "versaway",
  "versamark",
  "reviline", // revision line
  "revipane",
  "revifold",
  "revigate",
  "reviport",
  "revikeep",
  "diffline",
  "mergeline",
  "stageline",
  "patchline",
  "sideline", // common — expect taken
  "paneline",
  "changeline",
  "diffpath",
  "mergepath",
  "stagepath",
  "patchpath",
  "sidepath",
  "panepath",
  "changepath",
  "triway",
  "mergeway",
  "diffway",
  "stageway",
  "patchway",
  "sideway",
  "paneway",
  "codeway",
  "changeway",
  "trueway",
  "clearway",
  "denseway",
  "diffpulse",
  "mergepulse",
  "stagepulse",
  "patchpulse",
  "sidepulse",
  "panepulse",
  "changepulse",
  "diffshift",
  "mergeshift",
  "stageshift",
  "patchshift",
  "sideshift",
  "paneshift",
  "workshift",
  "diffbeam",
  "mergebeam",
  "patchbeam",
  "sidebeam",
  "panebeam",
  "difflight",
  "mergelight",
  "patchlight",
  "panelight",
  "sidelit",
  "difflit",
  "mergelit",
  "panelit",
  "patchlit",
  "diffly", // Grammarly-shaped
  "mergely",
  "patchly",
  "stagely",
  "sidely",
  "panely",
  "diffden",
  "mergeden",
  "stageden",
  "patchden",
  "sideden",
  "paneden",
  "workden",
  "codeden",
  "diffhall",
  "mergehall",
  "stagehall",
  "patchhall",
  "workhall",
  "codehall",
  "sidebench",
  "panebench",
  "patchbench",
  "changebench",
  "twinmark",
  "sidemark",
  "diffmark",
  "mergemark",
  "patchmark",
  "changemark",
  "trueline",
  "clearline",
  "deepline",
  "denseline",
  "softline",
  "thirdfold",
  "thirdpane",
  "thirdline",
  "thirdmark",
  "thirdgate",
  "thirdkeep",
  "thirdport",
  "thirdroom",
  "joinlane",
  "joingate",
  "joinkeep",
  "joinpath",
  "joinhaven",
  "joinport",
  "joinloom",
  "joincraft",
  "spliceway",
  "splicegate",
  "splicekeep",
  "splicelane",
  "foldgate",
  "foldlane",
  "foldkeep",
  "foldhaven",
  "foldport",
  "foldpath",
  "panecraft",
  "resultly",
  "comparly",
  "resolvly",
  "stageup",
  "mergeup",
  "diffup",
  "sideup",
  "fixup", // also git commit --fixup
  "syncup",
  "shipup",
  "pickaxe", // git pickaxe search — elevated term
  "worktree", // git worktree elevated
  "changeset", // elevated VCS term
];


const DOMAIN_PRIORITY = [".com", ".dev"];
const TIMEOUT_MS = 5000;

// ── Helpers ─────────────────────────────────────────────────────

function httpGet(url, timeout = TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { timeout, headers: { "User-Agent": "brand-checker/1.0" } },
      (res) => {
        if (
          [301, 302, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          res.resume();
          // Follow relative redirects
          const loc = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return resolve(httpGet(loc, timeout));
        }
        res.resume();
        resolve({ status: res.statusCode, finalUrl: url, error: null });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: null, finalUrl: url, error: "timeout" });
    });
    req.on("error", (err) =>
      resolve({ status: null, finalUrl: url, error: err.code || err.message }),
    );
  });
}

async function dnsResolves(domain) {
  try {
    await dns.resolve4(domain);
    return true;
  } catch {}
  try {
    await dns.resolve6(domain);
    return true;
  } catch {}
  try {
    await dns.resolveCname(domain);
    return true;
  } catch {}
  return false;
}

function checkRdap(domain) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "rdap.org",
        path: `/domain/${domain}`,
        method: "GET",
        timeout: TIMEOUT_MS,
        headers: { Accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const j = JSON.parse(data);
              const events = j.events || [];
              const reg = events.find(
                (e) => e.eventAction === "registration",
              )?.eventDate;
              const exp = events.find(
                (e) => e.eventAction === "expiration",
              )?.eventDate;
              resolve({ registered: true, regDate: reg, expDate: exp });
            } catch {
              resolve({ registered: true, regDate: null, expDate: null });
            }
          } else if (res.statusCode === 404) {
            resolve({ registered: false, regDate: null, expDate: null });
          } else {
            resolve({
              registered: null,
              regDate: null,
              expDate: null,
              rdapStatus: res.statusCode,
            });
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ registered: null, error: "timeout" });
    });
    req.on("error", () =>
      resolve({ registered: null, error: "rdap-unreachable" }),
    );
    req.end();
  });
}

async function checkDomain(name, tld) {
  const domain = `${name}${tld}`;
  const dnsOk = await dnsResolves(domain);
  if (dnsOk) {
    return { domain, available: false, reason: "DNS active" };
  }

  const rdap = await checkRdap(domain);
  if (rdap.registered === true) {
    return {
      domain,
      available: false,
      reason: "Registered (RDAP)",
      registered: rdap.regDate?.slice(0, 10),
      expires: rdap.expDate?.slice(0, 10),
    };
  }
  if (rdap.registered === false) {
    return { domain, available: true, reason: "Free (RDAP)" };
  }
  return { domain, available: true, reason: "Likely free (no DNS)" };
}

// ── Platform Checks ─────────────────────────────────────────────

async function checkGitHub(name) {
  const url = `https://github.com/${name}`;
  const { status } = await httpGet(url);
  if (status === 404) {
    return { name, platform: "GitHub", available: true };
  }
  if (status === 200) {
    return { name, platform: "GitHub", available: false, reason: "Exists" };
  }
  return {
    name,
    platform: "GitHub",
    available: null,
    reason: `HTTP ${status}`,
  };
}

async function checkX(name) {
  const url = `https://x.com/${name}`;
  const { status, error } = await httpGet(url);
  if (status === 404) {
    return { name, platform: "X/Twitter", available: true };
  }
  if (error) {
    return { name, platform: "X/Twitter", available: null, reason: error };
  }
  if (status === 200) {
    return { name, platform: "X/Twitter", available: false, reason: "Exists" };
  }
  return {
    name,
    platform: "X/Twitter",
    available: null,
    reason: `HTTP ${status}`,
  };
}

// ── CLI args ────────────────────────────────────────────────────
//   --json         emit machine-readable JSON (no progress/report)
//   --only=N       show full detail only for names with ≥ N free slots
//                  (default 2; 0 = show all)
//   --top=N        cap the 1-line "also checked" list to top N (default 20)
//   --verbose      full per-check breakdown for every name (old behavior)
const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, fallback) => {
  const m = args.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : fallback;
};
const AS_JSON = flag("json");
const VERBOSE = flag("verbose");
const TOP_N = Number(opt("top", "20"));
const ONLY_FREE = Number(opt("only", VERBOSE ? "0" : "2"));

// ── Scoring & glyphs ───────────────────────────────────────────
function scoreFn(r) {
  let s = 0;
  for (const d of r.domains) {
    if (!d.available) {
      continue;
    }
    if (d.domain.endsWith(".dev")) {
      s += 3;
    } else {
      s += 2; // .com is solid
    }
  }
  for (const p of r.platforms) {
    if (!p.available) {
      continue;
    }
    if (p.platform === "GitHub") {
      s += 4; // GitHub is top priority
    } else {
      s += 2; // x/twitter
    }
  }
  return s;
}

// Compact 4-glyph row. Order: .com .dev · gh x
function glyphs(r) {
  const com = r.domains.find((d) => d.domain.endsWith(".com"));
  const dev = r.domains.find((d) => d.dev || d.domain.endsWith(".dev"));
  const gh = r.platforms.find((p) => p.platform === "GitHub");
  const x = r.platforms.find((p) => p.platform === "X/Twitter");
  const mark = (c) =>
    c?.available === true ? "🟢" : c?.available === false ? "🔴" : "🟡";
  return `${mark(com)}${mark(dev)} ${mark(gh)}${mark(x)}`;
}

function freeCount(r) {
  return [...r.domains, ...r.platforms].filter((c) => c.available === true).length;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  if (!AS_JSON) {
    console.log("🔍 Brand Availability Checker (No .io / No npm Mode)");
    console.log("═".repeat(64));
    console.log(
      `Checking ${CANDIDATES.length} names × 4 checks (com/dev · github/x)`,
    );
    if (VERBOSE) {
      console.log("mode: --verbose (full breakdown for every name)");
    } else {
      console.log(`mode: compact  (--only free≥${ONLY_FREE}  --top ${TOP_N})`);
    }
    console.log("");
  }

  const results = [];
  let i = 0;
  const total = CANDIDATES.length;
  for (const name of CANDIDATES) {
    i++;
    const domains = await Promise.all(
      DOMAIN_PRIORITY.map((tld) => checkDomain(name, tld)),
    );
    const [gh, x] = await Promise.all([
      checkGitHub(name),
      checkX(name),
    ]);
    const r = { name, domains, platforms: [gh, x] };
    results.push(r);
    if (!AS_JSON) {
      const pct = Math.round((i / total) * 100);
      const free = freeCount(r);
      const star = free >= 3 ? " ⭐" : free >= 2 ? " ✅" : "";
      process.stdout.write(
        `\r${String(i).padStart(3)}/${total} ${String(pct).padStart(3)}%  ${name.padEnd(14)} ${glyphs(r)} (${free}/4)${star}   `,
      );
    }
  }
  if (!AS_JSON) {
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }

  results.sort((a, b) => scoreFn(b) - scoreFn(a));

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        results.map((r) => ({
          name: r.name,
          score: scoreFn(r),
          free: freeCount(r),
          domains: r.domains.map((d) => ({
            domain: d.domain,
            available: d.available,
            reason: d.reason,
            ...(d.registered ? { registered: d.registered } : {}),
            ...(d.expires ? { expires: d.expires } : {}),
          })),
          platforms: r.platforms.map((p) => ({
            platform: p.platform,
            available: p.available,
            reason: p.reason,
          })),
        })),
        null,
        2,
      ),
    );
    return;
  }

  // ── Compact report ──
  console.log("═".repeat(64));
  const winners = results.filter((r) => freeCount(r) >= ONLY_FREE);

  if (VERBOSE) {
    for (const r of results) {
      printDetail(r);
    }
  } else if (winners.length) {
    console.log(`⭐ WINNERS (free≥${ONLY_FREE}/4) — ${winners.length} name(s)\n`);
    for (const r of winners) {
      printDetail(r);
    }

    const rest = results
      .filter((r) => freeCount(r) < ONLY_FREE)
      .slice(0, TOP_N);
    if (rest.length) {
      console.log("─".repeat(64));
      console.log(`also checked (top ${rest.length} by score, 1-line):\n`);
      for (const r of rest) {
        console.log(
          `  ${r.name.padEnd(14)} ${glyphs(r)}  ${freeCount(r)}/4  score ${scoreFn(r)}`,
        );
      }
    }
  } else {
    console.log(`❌ No name cleared free≥${ONLY_FREE}/4. Top 20 by score:\n`);
    for (const r of results.slice(0, TOP_N)) {
      console.log(
        `  ${r.name.padEnd(14)} ${glyphs(r)}  ${freeCount(r)}/4  score ${scoreFn(r)}`,
      );
    }
  }

  console.log("\n" + "─".repeat(64));
  console.log("legend: 🟢 free  🔴 taken  🟡 unknown  | order: com dev · gh x");
  console.log("note: domain via RDAP (rdap.org) — verify on a registrar.");
  console.log("      github/x may rate-limit (🟡) — verify manually.");
  console.log("flags: --verbose  --only=N  --top=N  --json");
  console.log("");
}

function printDetail(r) {
  const com = r.domains.find((d) => d.domain.endsWith(".com"));
  const dev = r.domains.find((d) => d.domain.endsWith(".dev"));
  const gh = r.platforms.find((p) => p.platform === "GitHub");
  const x = r.platforms.find((p) => p.platform === "X/Twitter");
  const free = freeCount(r);
  const icon = free >= 3 ? "⭐" : "✅";
  console.log(`${icon} ${r.name}  (${free}/4 free)`);
  const fmt = (c, label) =>
    c
      ? `  ${label.padEnd(5)} ${c.available ? "🟢 free" : "🔴 " + (c.reason || "taken")}`
      : `  ${label.padEnd(5)} 🟡 unknown`;
  console.log(fmt(com, ".com"));
  console.log(fmt(dev, ".dev"));
  console.log(`  github ${gh?.available ? "🟢 free" : gh?.available === null ? "🟡 ?" : "🔴 taken"}`);
  console.log(`  x      ${x?.available ? "🟢 free" : x?.available === null ? "🟡 ?" : "🔴 taken"}`);
  if (com && !com.available && com.expires) {
    console.log(`         (reg ${com.registered} · exp ${com.expires})`);
  }
  console.log("");
}

main().catch(console.error);
