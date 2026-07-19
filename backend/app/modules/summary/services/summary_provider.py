"""
AI summarization integration point.

Real summaries are meant to come from OpenAI (per the architecture).
This environment has no API key configured, so `RuleBasedSummaryProvider`
is used instead — it produces a real, useful digest by aggregating the
site's recent daily reports without calling any LLM, so the feature is
genuinely usable today and upgrades transparently once a key exists.

TODO(integration): set OPENAI_API_KEY in the environment/.env and
`OpenAISummaryProvider` takes over automatically via
`get_summary_provider()` — nothing else in this module needs to change.
"""

from abc import ABC, abstractmethod
from collections import Counter
from typing import List

from app.core.config import get_settings
from app.modules.report.models.report_model import DailyReport

settings = get_settings()


class SummaryProvider(ABC):
    model_name: str

    @abstractmethod
    def summarize(self, site_name: str, reports: List[DailyReport]) -> str: ...


class RuleBasedSummaryProvider(SummaryProvider):
    model_name = "rule-based-v1"

    def summarize(self, site_name: str, reports: List[DailyReport]) -> str:
        if not reports:
            return f"No daily reports have been logged for {site_name} yet."

        ordered = sorted(reports, key=lambda r: r.report_date)
        total_manpower = sum(r.manpower_count or 0 for r in ordered)
        days_with_manpower = sum(1 for r in ordered if r.manpower_count is not None)
        avg_manpower = round(total_manpower / days_with_manpower) if days_with_manpower else None

        weather_counts = Counter(r.weather for r in ordered if r.weather)
        common_weather = weather_counts.most_common(1)[0][0] if weather_counts else None

        issues = [f"{r.report_date}: {r.issues}" for r in ordered if r.issues]

        lines = [
            f"Summary of the last {len(ordered)} report(s) for {site_name} "
            f"({ordered[0].report_date} to {ordered[-1].report_date}):",
        ]
        if avg_manpower is not None:
            lines.append(f"- Average manpower on site: {avg_manpower} workers/day.")
        if common_weather:
            lines.append(f"- Most common weather: {common_weather}.")

        lines.append("- Progress highlights:")
        for r in ordered[-3:]:
            lines.append(f"  • {r.report_date}: {r.work_summary}")

        if issues:
            lines.append(f"- {len(issues)} day(s) reported issues or blockers:")
            for issue in issues[-3:]:
                lines.append(f"  ⚠ {issue}")
        else:
            lines.append("- No blockers reported in this period.")

        return "\n".join(lines)


class OpenAISummaryProvider(SummaryProvider):
    model_name = "gpt-4o-mini"

    def summarize(self, site_name: str, reports: List[DailyReport]) -> str:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        report_lines = "\n".join(
            f"- {r.report_date}: manpower={r.manpower_count}, weather={r.weather}, "
            f"summary={r.work_summary}, issues={r.issues or 'none'}"
            for r in sorted(reports, key=lambda r: r.report_date)
        )
        prompt = (
            f"You are a construction site progress assistant. Summarize the following "
            f"daily reports for site '{site_name}' into a short, actionable digest for a "
            f"project manager. Call out delays or blockers explicitly.\n\n{report_lines}"
        )
        response = client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""


def get_summary_provider() -> SummaryProvider:
    if settings.openai_api_key:
        return OpenAISummaryProvider()
    return RuleBasedSummaryProvider()
