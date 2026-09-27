import { readFile, writeFile } from "node:fs/promises";

async function patch(path, replacements) {
  let source = await readFile(path, "utf8");
  for (const [before, after, label] of replacements) {
    if (!source.includes(before)) throw new Error(`${path}: no se encontró ${label}`);
    source = source.replace(before, after);
  }
  await writeFile(path, source);
}

await patch("src/components/DraftAssistant.tsx", [
  [
    'const QUEUE_MODE_KEY = "brawl-lab:queue-mode-v1";',
    'const QUEUE_MODE_KEY = "brawl-lab:queue-mode-v1";\nconst VOICE_PICK_COMMIT_EVENT = "brawl-draft-lab:voice-pick-commit";',
    "constante de evento de pick",
  ],
  [
    '() => maps\n      .filter((map) => map.mode === mode)\n      .sort((a, b) =>\n        Number(b.rotationStatus === "Actual") - Number(a.rotationStatus === "Actual") ||\n        a.name.localeCompare(b.name)\n      ),',
    '() => maps\n      .filter((map) => map.mode === mode && map.rotationStatus === "Actual")\n      .sort((a, b) => a.name.localeCompare(b.name)),',
    "filtro de mapas actuales",
  ],
  [
    '  }, [queueMode, queueLoaded]);\n\n  const map = maps.find((item) => item.slug === mapSlug) || availableMaps[0];',
    `  }, [queueMode, queueLoaded]);\n\n  useEffect(() => {\n    const commitVoicePick = (event: Event) => {\n      const requested = (event as CustomEvent<{ name?: string }>).detail?.name?.trim();\n      if (!requested) return;\n      const profile = brawlers.find((brawler) => normalize(brawler.name) === normalize(requested));\n      if (!profile) return;\n\n      let committed = false;\n      setOrderedPicks((current) => {\n        const next = current.findIndex((pick) => !pick);\n        if (next < 0) return current;\n        const blocked = new Set([\n          ...current.filter(Boolean).map((name) => normalize(name as string)),\n          ...bans.map(normalize),\n        ]);\n        if (blocked.has(normalize(profile.name))) return current;\n        committed = true;\n        return current.map((pick, index) => index === next ? profile.name : pick);\n      });\n\n      if (committed) {\n        setScenarioEnemy(\"\");\n        setPlayedBrawler(\"\");\n        setMatchNote(\"\");\n        setQuery(\"\");\n        setFocused(false);\n      }\n    };\n\n    window.addEventListener(VOICE_PICK_COMMIT_EVENT, commitVoicePick as EventListener);\n    return () => window.removeEventListener(VOICE_PICK_COMMIT_EVENT, commitVoicePick as EventListener);\n  }, [brawlers, bans]);\n\n  const map = maps.find((item) => item.slug === mapSlug) || availableMaps[0];`,
    "listener React de voz",
  ],
  [
    '<div><span className="eyebrow">Draft Coach · motor U69 v0.32.1</span><h2>Introduce los picks en orden</h2></div>',
    '<div><span className="eyebrow">Draft Coach · motor U69 v0.36.1</span><h2>Introduce los picks en orden</h2></div>',
    "etiqueta de versión",
  ],
  [
    '{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}{item.rotationStatus === "Histórico" ? " · histórico" : ""}</option>)}',
    '{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}',
    "selector de mapas",
  ],
]);

await patch("src/components/VoiceDraftControl.tsx", [
  [
    'const VOICE_START_EVENT = "brawl-draft-lab:voice-start";',
    'const VOICE_START_EVENT = "brawl-draft-lab:voice-start";\nconst VOICE_PICK_COMMIT_EVENT = "brawl-draft-lab:voice-pick-commit";',
    "constante de commit React",
  ],
  [
    '  if (targetMode === "pick" && typeof expectedPickIndex !== "number") return "failed";\n\n  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {',
    `  if (targetMode === "pick" && typeof expectedPickIndex !== "number") return "failed";\n\n  if (targetMode === "pick" && typeof expectedPickIndex === "number") {\n    const before = selectedEntries(targetMode);\n    for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {\n      if (hasSelected(name, targetMode)) return "already";\n      window.dispatchEvent(new CustomEvent(VOICE_PICK_COMMIT_EVENT, { detail: { name } }));\n      const outcome = await waitForCommitOutcome(\n        name,\n        targetMode,\n        before,\n        expectedPickIndex,\n        1000 + attempt * 300,\n      );\n      if (outcome === "added") return "added";\n      if (outcome === "wrong") await rollbackUnexpected(targetMode, before, expectedPickIndex);\n      await sleep(140 + attempt * 90);\n    }\n    return normalizeVoice(pickSlotEntries()[expectedPickIndex] || "") === normalizeVoice(name) ? "added" : "failed";\n  }\n\n  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {`,
    "commit directo de pick",
  ],
]);

console.log("Patch v0.36.1 aplicado: Ranked actual + voz de picks conectada directamente al estado React.");
