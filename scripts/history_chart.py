#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
# SPDX-License-Identifier: GPL-3.0-or-later

"""Draw how the code and its test coverage grew over the project's commits.

Two series are plotted against the commit date:

* **Lines of code**, split into the rules core, the renderer, the UI, the unit tests and the browser
  tests. Read straight out of git, so every commit on the branch is measured, not just the tags.
* **Core coverage** — statements, branches, functions and lines — as Vitest reports it. Measuring
  that means running the suite at a past commit, which is slow, so it is sampled (every ``--every``
  commits by default) and cached in ``docs/history-coverage.json``. A later run only measures the
  commits the cache does not know yet.

Usage::

    python3 scripts/history_chart.py                 # every tenth commit, cache filled in as needed
    python3 scripts/history_chart.py --every 20      # coarser sampling
    python3 scripts/history_chart.py --no-measure    # draw from the cache, never run the suite

The chart lands in ``docs/screenshots/history.png`` and is embedded at the bottom of the README.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "docs" / "history-coverage.json"
OUT = ROOT / "docs" / "screenshots" / "history.png"

#: Which files count towards which band of the area chart, in drawing order.
GROUPS: dict[str, tuple[str, ...]] = {
    "core (rules)": ("src/core/",),
    "render": ("src/render/",),
    "app + UI": ("src/ui/", "src/app.ts", "src/audio.ts", "src/main.ts"),
    "unit tests": ("tests/",),
    "browser tests": ("e2e/",),
}
COUNTED_SUFFIXES = (".ts", ".css")
COLOURS = ["#3f7d4e", "#4f8dd6", "#c58a2e", "#8e5bbd", "#c2544a"]
METRIC_COLOURS = {"statements": "#3f7d4e", "branches": "#c2544a", "functions": "#4f8dd6", "lines": "#8e5bbd"}


def git(*args: str, cwd: Path = ROOT) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout


@dataclass
class Commit:
    sha: str
    when: datetime
    version: str


def commits() -> list[Commit]:
    """Every commit on the current branch, oldest first, with its author date."""
    out = git("log", "--reverse", "--format=%H%x09%aI")
    found: list[Commit] = []
    for line in out.splitlines():
        sha, iso = line.split("\t")
        found.append(Commit(sha, datetime.fromisoformat(iso).astimezone(timezone.utc), ""))
    return found


def group_of(path: str) -> str | None:
    if not path.endswith(COUNTED_SUFFIXES):
        return None
    for name, prefixes in GROUPS.items():
        if any(path.startswith(prefix) for prefix in prefixes):
            return name
    return None


def line_counts(shas: list[str]) -> list[dict[str, int]]:
    """Lines per group for each commit, using one `git cat-file --batch` for all of them."""
    wanted: list[tuple[int, str, str]] = []  # (commit index, group, blob sha)
    for index, sha in enumerate(shas):
        for entry in git("ls-tree", "-r", sha).splitlines():
            meta, path = entry.split("\t", 1)
            _mode, kind, blob = meta.split(" ")
            if kind != "blob":
                continue
            group = group_of(path)
            if group:
                wanted.append((index, group, blob))

    sizes: dict[str, int] = {}
    todo = sorted({blob for _, _, blob in wanted})
    if todo:
        batch = subprocess.run(
            ["git", "cat-file", "--batch"],
            cwd=ROOT,
            input=("\n".join(todo) + "\n").encode(),
            capture_output=True,
            check=True,
        )
        data = batch.stdout
        offset = 0
        for blob in todo:
            newline = data.index(b"\n", offset)
            header = data[offset:newline].decode()
            length = int(header.split(" ")[2])
            body = data[newline + 1 : newline + 1 + length]
            sizes[blob] = body.count(b"\n")
            offset = newline + 1 + length + 1

    counts = [{name: 0 for name in GROUPS} for _ in shas]
    for index, group, blob in wanted:
        counts[index][group] += sizes.get(blob, 0)
    return counts


def load_cache() -> dict[str, dict[str, float]]:
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    return {}


def measure_coverage(sha: str) -> dict[str, float] | None:
    """Run the unit tests with coverage at `sha` in a throwaway worktree. Slow; cached by caller."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = Path(tmp) / "tree"
        git("worktree", "add", "--detach", str(tree), sha)
        try:
            # The installed dependencies are reused: the point is to measure the sources, and
            # installing per commit would take hours.
            (tree / "node_modules").symlink_to(ROOT / "node_modules")
            run = subprocess.run(
                ["npx", "vitest", "run", "--coverage", "--coverage.thresholds.100=false", "--reporter=dot"],
                cwd=tree,
                capture_output=True,
                text=True,
                timeout=600,
            )
            summary = tree / "coverage" / "coverage-summary.json"
            if summary.exists():
                total = json.loads(summary.read_text())["total"]
                return {metric: total[metric]["pct"] for metric in METRIC_COLOURS}
            return parse_text_summary(run.stdout)
        except (subprocess.SubprocessError, OSError) as error:
            print(f"  coverage for {sha[:8]} failed: {error}", file=sys.stderr)
            return None
        finally:
            git("worktree", "remove", "--force", str(tree))


def parse_text_summary(output: str) -> dict[str, float] | None:
    """Fall back to the text summary Vitest always prints."""
    found: dict[str, float] = {}
    for line in output.splitlines():
        for metric in METRIC_COLOURS:
            if line.strip().lower().startswith(metric):
                try:
                    found[metric] = float(line.split(":")[1].strip().split("%")[0])
                except (IndexError, ValueError):
                    pass
    return found if len(found) == len(METRIC_COLOURS) else None


def draw(history: list[Commit], counts: list[dict[str, int]], coverage: dict[str, dict[str, float]]) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # The x axis counts commits, not days: the project was written in bursts, and a date axis
    # squeezes nine tenths of the work into the last centimetre. Dates go on the ticks instead.
    x = list(range(len(history)))
    figure, (top, bottom) = plt.subplots(
        2, 1, figsize=(11, 7), sharex=True, gridspec_kw={"height_ratios": [2, 1], "hspace": 0.1}
    )
    figure.patch.set_facecolor("#ffffff")

    top.stackplot(
        x,
        *[[count[name] for count in counts] for name in GROUPS],
        labels=list(GROUPS),
        colors=COLOURS,
        alpha=0.9,
    )
    total = [sum(count.values()) for count in counts]
    top.plot(x, total, color="#222", linewidth=1.2, label="total")
    top.set_ylabel("lines of code")
    top.set_title("Allium Assault — code and core test coverage over the project's commits")
    top.legend(loc="upper left", fontsize=9, framealpha=0.9)
    top.grid(alpha=0.25)
    top.annotate(
        f"{total[-1]:,} lines",
        xy=(x[-1], total[-1]),
        xytext=(-6, 8),
        textcoords="offset points",
        ha="right",
        fontsize=9,
        color="#222",
    )
    # The 3D rewrite: the single largest drop in the line is where the old prototype was thrown
    # away, and the chart is hard to read without saying so.
    if len(total) > 2:
        loss, trough = max(((total[k - 1] - total[k], k) for k in range(1, len(total))), key=lambda pair: pair[0])
        if loss > 500:
            top.axvline(trough, color="#555", linestyle=":", linewidth=1)
            top.annotate(
                "2D prototype dropped,\n3D game starts here",
                xy=(trough, max(total) * 0.5),
                xytext=(8, 0),
                textcoords="offset points",
                fontsize=8,
                color="#555",
            )

    measured = [(index, coverage[c.sha]) for index, c in enumerate(history) if c.sha in coverage]
    if measured:
        for metric, colour in METRIC_COLOURS.items():
            bottom.plot(
                [index for index, _ in measured],
                [values[metric] for _, values in measured],
                marker="o",
                markersize=3.5,
                linewidth=1.4,
                color=colour,
                label=metric,
            )
        lowest = min(v for _, values in measured for v in values.values())
        bottom.set_ylim(max(0, lowest - 4), 101)
        bottom.legend(loc="lower left", fontsize=9, ncol=4, framealpha=0.9)
    else:
        bottom.text(0.5, 0.5, "no coverage measured yet", ha="center", va="center", transform=bottom.transAxes)
    bottom.axhline(98, color="#888", linestyle="--", linewidth=1)
    bottom.annotate(
        "enforced 98%", xy=(0.01, 98), xycoords=("axes fraction", "data"), fontsize=8, color="#666", va="bottom"
    )
    bottom.set_ylabel("core coverage (%)")
    bottom.set_xlabel("commit")
    bottom.grid(alpha=0.25)

    step = max(1, len(history) // 8)
    ticks = list(range(0, len(history), step))
    # Only add the final commit when it would not sit on top of the tick before it.
    if len(history) - 1 - ticks[-1] > step * 0.4:
        ticks.append(len(history) - 1)
    bottom.set_xticks(ticks)
    bottom.set_xticklabels([f"{index}\n{history[index].when:%Y-%m-%d}" for index in ticks], fontsize=8)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(OUT, dpi=110, bbox_inches="tight")
    print(f"wrote {OUT.relative_to(ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--every", type=int, default=10, help="measure coverage every Nth commit (0: cache only)")
    parser.add_argument("--no-measure", action="store_true", help="never run the test suite, use the cache as it is")
    args = parser.parse_args()

    history = commits()
    if not history:
        print("no commits found", file=sys.stderr)
        return 1
    print(f"{len(history)} commits, {history[0].when.date()} to {history[-1].when.date()}")

    coverage = load_cache()
    if args.every and not args.no_measure:
        sampled = history[:: args.every] + [history[-1]]
        for commit in sampled:
            if commit.sha in coverage:
                continue
            print(f"measuring coverage at {commit.sha[:8]} ({commit.when.date()}) …")
            result = measure_coverage(commit.sha)
            if result:
                coverage[commit.sha] = result
                CACHE.write_text(json.dumps(coverage, indent=2, sort_keys=True) + "\n")

    draw(history, line_counts([c.sha for c in history]), coverage)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
