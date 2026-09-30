"use client";
// components/crm/AutomationsModal.tsx
//
// The "Automate" modal from the leads-updates.css reference: a category
// rail, a search box, a dark hero banner, and grids of recipe cards.
//
// This app has no automation engine (no cron/trigger runner, no rule
// storage) — building one is a separate project. This is deliberately an
// interactive UI shell: categories filter the recipe grid client-side,
// search filters by sentence text, and picking a recipe or switching to
// "Manage" surfaces a "coming soon" state instead of doing anything real.
// Wire it up to a real rules table + engine when that work is scoped.

import React, { useMemo, useState } from "react";
import styles from "./AutomationsModal.module.css";

type CardTone = "blue" | "slate" | "gold";
type Category =
  | "explore"
  | "popular"
  | "dates"
  | "status"
  | "notify"
  | "assign"
  | "recurring"
  | "integrations";

interface Recipe {
  id: string;
  tone: CardTone;
  sentence: Array<{ text: string; strong?: boolean }>;
  categories: Category[];
}

const RECIPES: Recipe[] = [
  {
    id: "followup-notify-owner",
    tone: "blue",
    categories: ["explore", "popular", "dates", "notify"],
    sentence: [
      { text: "When" },
      { text: "Follow-up date", strong: true },
      { text: "arrives", strong: true },
      { text: "then" },
      { text: "notify", strong: true },
      { text: "the row owner", strong: true },
    ],
  },
  {
    id: "status-opportunity-notify",
    tone: "slate",
    categories: ["explore", "popular", "status", "notify"],
    sentence: [
      { text: "When" },
      { text: "Status", strong: true },
      { text: "changes to" },
      { text: "Opportunity", strong: true },
      { text: "then" },
      { text: "notify", strong: true },
      { text: "Marcus Yin", strong: true },
    ],
  },
  {
    id: "new-lead-assign-owner",
    tone: "gold",
    categories: ["explore", "popular", "assign"],
    sentence: [
      { text: "When" },
      { text: "a new lead", strong: true },
      { text: "is added" },
      { text: "then" },
      { text: "assign", strong: true },
      { text: "the row owner", strong: true },
    ],
  },
  {
    id: "quote-sent-followup",
    tone: "blue",
    categories: ["explore", "dates"],
    sentence: [
      { text: "When" },
      { text: "Quote sent date", strong: true },
      { text: "is 3 days away", strong: true },
      { text: "then" },
      { text: "set follow-up date", strong: true },
      { text: "to" },
      { text: "3 days later", strong: true },
    ],
  },
  {
    id: "status-opportunity-move",
    tone: "slate",
    categories: ["explore", "status"],
    sentence: [
      { text: "When" },
      { text: "Status", strong: true },
      { text: "changes to" },
      { text: "Opportunity", strong: true },
      { text: "then" },
      { text: "move to", strong: true },
      { text: "Opportunities", strong: true },
    ],
  },
  {
    id: "weekly-notify-team",
    tone: "gold",
    categories: ["explore", "recurring", "notify"],
    sentence: [
      { text: "When" },
      { text: "every week", strong: true },
      { text: "rolls around on" },
      { text: "Monday morning", strong: true },
      { text: "then" },
      { text: "notify", strong: true },
      { text: "the whole team", strong: true },
    ],
  },
];

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  {
    id: "explore",
    label: "Explore",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "popular",
    label: "Popular",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.6 8.6L21.5 9.3L16.3 13.9L17.9 20.7L12 17.1L6.1 20.7L7.7 13.9L2.5 9.3L9.4 8.6L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "dates",
    label: "Dates",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "status",
    label: "Status",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h16M6 12h12M9 18h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "notify",
    label: "Notify",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 9a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6zM13.7 20a2 2 0 01-3.4 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "assign",
    label: "Assign",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5M17 8v6M20 11h-6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "recurring",
    label: "Recurring",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12a8 8 0 0113.7-5.7L20 8M20 12a8 8 0 01-13.7 5.7L4 16M20 4v4h-4M4 20v-4h4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 3v6M15 3v6M7 9h10v4a5 5 0 01-10 0V9zM12 18v3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const TONE_CLASS: Record<CardTone, string> = {
  blue: "cardIconBlue",
  slate: "cardIconSlate",
  gold: "cardIconGold",
};

function matchesQuery(recipe: Recipe, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return recipe.sentence.some((part) => part.text.toLowerCase().includes(q));
}

interface AutomationsModalProps {
  boardLabel: string;
  onClose: () => void;
  onPickRecipe: () => void;
}

export default function AutomationsModal({
  boardLabel,
  onClose,
  onPickRecipe,
}: AutomationsModalProps) {
  const [tab, setTab] = useState<"create" | "manage">("create");
  const [category, setCategory] = useState<Category>("explore");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      RECIPES.filter((r) => r.categories.includes(category)).filter((r) =>
        matchesQuery(r, query),
      ),
    [category, query],
  );
  const basics = filtered.slice(0, 3);
  const more = filtered.slice(3);

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.auto} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.headTitles}>
            <span className={styles.title}>Automations</span>
            <span className={styles.board}>{boardLabel}</span>
          </div>
          <div className={styles.seg}>
            <button
              type="button"
              className={`${styles.segBtn} ${tab === "create" ? styles.segOn : ""}`}
              onClick={() => setTab("create")}
            >
              Create
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${tab === "manage" ? styles.segOn : ""}`}
              onClick={() => setTab("manage")}
            >
              Manage
            </button>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.cats}>
            <span className={styles.catsLabel}>Categories</span>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.cat} ${category === c.id ? styles.catOn : ""}`}
                onClick={() => setCategory(c.id)}
              >
                {c.icon}
                <span>{c.label}</span>
              </button>
            ))}

            <div className={styles.catsSpacer} />

            <div className={styles.catsFoot}>
              <span>Connected</span>
              <div className={styles.conn}>
                <div className={styles.connG} title="Gmail">G</div>
                <div className={styles.connO} title="Outlook">O</div>
                <div className={styles.connS} title="Slack">S</div>
                <div className={styles.connX} title="Xero">X</div>
              </div>
            </div>
          </div>

          <div className={styles.main}>
            {tab === "manage" ? (
              <div className={styles.manageEmpty}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className={styles.manageEmptyTitle}>No automations yet</span>
                <span className={styles.manageEmptyBody}>
                  Automations you build in Create will show up here.
                </span>
              </div>
            ) : (
              <>
                <div className={styles.search}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M21.5 21.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search automations"
                  />
                </div>

                <div className={styles.hero}>
                  <div className={styles.heroGrid} />
                  <div className={styles.heroBloom} />
                  <div className={styles.heroCopy}>
                    <span className={styles.heroEyebrow}>Build it in a sentence</span>
                    <span className={styles.heroLine}>
                      When <em>a date lands</em>, tell <em>the right person</em> — before the
                      client has to ask.
                    </span>
                  </div>
                  <div className={styles.heroCta} onClick={onPickRecipe}>
                    Build your own
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className={styles.noResults}>
                    No automations match &ldquo;{query}&rdquo; in this category.
                  </div>
                ) : (
                  <>
                    <div className={styles.sec}>
                      <span className={styles.secTitle}>Start with the basics</span>
                      <div className={styles.cards}>
                        {basics.map((r) => (
                          <RecipeCard key={r.id} recipe={r} onPick={onPickRecipe} />
                        ))}
                      </div>
                    </div>

                    {more.length > 0 && (
                      <div className={styles.sec}>
                        <div className={styles.secHead}>
                          <span className={styles.secTitle}>More recipes</span>
                          <span className={styles.secCount}>{more.length}</span>
                        </div>
                        <div className={styles.cards}>
                          {more.map((r) => (
                            <RecipeCard key={r.id} recipe={r} onPick={onPickRecipe} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecipeCard({ recipe, onPick }: { recipe: Recipe; onPick: () => void }) {
  return (
    <div className={styles.card} onClick={onPick} role="button" tabIndex={0}>
      <div className={`${styles.cardIcon} ${styles[TONE_CLASS[recipe.tone]]}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={styles.cardSentence}>
        {recipe.sentence.map((part, i) =>
          part.strong ? (
            <b key={i}>{part.text}</b>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </div>
      <div className={styles.cardGo}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
