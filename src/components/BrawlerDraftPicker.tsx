"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Brawler } from "@/lib/types";
import { BrawlerPortrait } from "./GameArtwork";

type Tone = "ally" | "enemy" | "ban";

export default function BrawlerDraftPicker({
  title,
  subtitle,
  values,
  max,
  roster,
  unavailable,
  tone,
  onChange,
}: {
  title: string;
  subtitle: string;
  values: string[];
  max: number;
  roster: Brawler[];
  unavailable: Set<string>;
  tone: Tone;
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const normalize = (value: string) => value.trim().toLowerCase();
  const atLimit = values.length >= max;

  const suggestions = useMemo(() => {
    const search = normalize(query);
    return roster
      .filter((brawler) => !unavailable.has(normalize(brawler.name)))
      .filter((brawler) => !search || normalize(brawler.name).includes(search))
      .sort((a, b) => {
        if (a.profileComplete !== b.profileComplete) return a.profileComplete ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      })
      .slice(0, 8);
  }, [query, roster, unavailable]);

  const add = (name: string) => {
    if (atLimit || values.some((value) => normalize(value) === normalize(name))) return;
    onChange([...values, name]);
    setQuery("");
    setFocused(false);
  };

  const remove = (name: string) => onChange(values.filter((value) => value !== name));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && suggestions[0]) {
      event.preventDefault();
      add(suggestions[0].name);
    }
    if (event.key === "Backspace" && !query && values.length) {
      remove(values[values.length - 1]);
    }
  };

  return (
    <section className={`draft-picker draft-picker-${tone}`}>
      <div className="draft-picker-head">
        <div>
          <b>{title}</b>
          <span>{subtitle}</span>
        </div>
        <small>{values.length}/{max}</small>
      </div>

      <div className="draft-slots">
        {Array.from({ length: max }).map((_, index) => {
          const name = values[index];
          return name ? (
            <button
              type="button"
              className="draft-slot filled"
              key={name}
              onClick={() => remove(name)}
              title={`Quitar ${name}`}
            >
              <BrawlerPortrait name={name} className="draft-slot-avatar" />
              <span>{name}</span>
              <i>×</i>
            </button>
          ) : (
            <div className="draft-slot empty" key={`empty-${index}`}>
              <span>+</span>
            </div>
          );
        })}
      </div>

      <div className="draft-search-wrap">
        <input
          value={query}
          disabled={atLimit}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={atLimit ? "Slots completos" : "Buscar brawler…"}
          aria-label={`Añadir a ${title}`}
        />
        {focused && !atLimit && suggestions.length > 0 && (
          <div className="draft-suggestions">
            {suggestions.map((brawler) => (
              <button type="button" key={brawler.slug} onMouseDown={() => add(brawler.name)}>
                <BrawlerPortrait name={brawler.name} className="suggestion-avatar" />
                <span><b>{brawler.name}</b><small>{brawler.role} · {brawler.tier}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
