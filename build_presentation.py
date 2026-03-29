#!/usr/bin/env python3
"""
Spec-Driven Development Presentation Generator
Produces: presentation/spec-driven-development.pptx
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import os

# ── Palette ──────────────────────────────────────────────────────────────────
NAVY      = RGBColor(0x1E, 0x2A, 0x3A)   # dark background / headings
ORANGE    = RGBColor(0xF4, 0x68, 0x00)   # Grafana orange accent
TEAL      = RGBColor(0x00, 0xB0, 0xA0)   # secondary accent
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_BG  = RGBColor(0xF5, 0xF7, 0xFA)   # slide background
CODE_BG   = RGBColor(0x1E, 0x1E, 0x2E)   # dark code block
CODE_FG   = RGBColor(0xCB, 0xD0, 0xFF)   # code text
GRAY      = RGBColor(0x55, 0x65, 0x7A)
MID_GRAY  = RGBColor(0xCC, 0xD0, 0xD8)

W = Inches(13.33)   # widescreen width
H = Inches(7.5)     # widescreen height


# ── Helpers ───────────────────────────────────────────────────────────────────

def add_slide(prs, layout_idx=6):
    """Add a blank slide (layout 6 = blank)."""
    layout = prs.slide_layouts[layout_idx]
    return prs.slides.add_slide(layout)


def rect(slide, x, y, w, h, fill=None, line=None, line_width=Pt(0)):
    from pptx.util import Emu
    shape = slide.shapes.add_shape(1, x, y, w, h)  # MSO_SHAPE_TYPE.RECTANGLE = 1
    shape.line.width = line_width
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    else:
        shape.fill.background()
    if line:
        shape.line.color.rgb = line
    else:
        shape.line.fill.background()
    return shape


def textbox(slide, text, x, y, w, h,
            size=Pt(18), bold=False, color=NAVY,
            align=PP_ALIGN.LEFT, wrap=True, italic=False):
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = wrap
    tf = txb.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = size
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txb


def add_paragraph(tf, text, size=Pt(16), bold=False, color=NAVY,
                  align=PP_ALIGN.LEFT, space_before=Pt(6), italic=False):
    p = tf.add_paragraph()
    p.alignment = align
    p.space_before = space_before
    run = p.add_run()
    run.text = text
    run.font.size = size
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return p


def slide_bg(slide, color=LIGHT_BG):
    rect(slide, 0, 0, W, H, fill=color)


def accent_bar(slide, color=ORANGE, height=Inches(0.08)):
    rect(slide, 0, 0, W, height, fill=color)


def bottom_bar(slide, color=NAVY, height=Inches(0.45)):
    rect(slide, 0, H - height, W, height, fill=color)
    textbox(slide, "Spec-Driven Development  |  Grafana Log POC",
            Inches(0.3), H - height + Pt(4), Inches(8), height,
            size=Pt(10), color=MID_GRAY)


def slide_number(slide, n):
    textbox(slide, str(n),
            W - Inches(0.6), H - Inches(0.45) + Pt(4), Inches(0.4), Inches(0.35),
            size=Pt(10), color=MID_GRAY, align=PP_ALIGN.RIGHT)


def section_tag(slide, label, color=ORANGE):
    tag = rect(slide, Inches(0.5), Inches(1.1), Inches(2.2), Inches(0.32), fill=color)
    textbox(slide, label.upper(),
            Inches(0.5), Inches(1.1), Inches(2.2), Inches(0.32),
            size=Pt(9), bold=True, color=WHITE, align=PP_ALIGN.CENTER)


def heading(slide, title, y=Inches(1.55), size=Pt(34), color=NAVY):
    textbox(slide, title,
            Inches(0.5), y, Inches(12.3), Inches(0.8),
            size=size, bold=True, color=color)


def bullet_box(slide, items, x, y, w, h, size=Pt(17), color=NAVY, bullet="●"):
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = True
    tf = txb.text_frame
    tf.word_wrap = True
    first = True
    for item in items:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.space_before = Pt(8)
        run = p.add_run()
        run.text = f"{bullet}  {item}"
        run.font.size = size
        run.font.color.rgb = color
    return txb


def code_block(slide, code, x, y, w, h, size=Pt(11)):
    bg = rect(slide, x, y, w, h, fill=CODE_BG)
    bg.line.fill.background()
    # left accent line
    rect(slide, x, y, Inches(0.06), h, fill=ORANGE)
    txb = slide.shapes.add_textbox(x + Inches(0.15), y + Pt(8), w - Inches(0.2), h - Pt(16))
    txb.word_wrap = False
    tf = txb.text_frame
    tf.word_wrap = False
    lines = code.strip().split("\n")
    first = True
    for line in lines:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        run = p.add_run()
        run.text = line
        run.font.size = size
        run.font.color.rgb = CODE_FG
        run.font.name = "Courier New"
    return txb


def callout_box(slide, label, value, x, y, w, h, bg=NAVY, label_color=ORANGE, value_color=WHITE):
    rect(slide, x, y, w, h, fill=bg)
    textbox(slide, label, x, y + Inches(0.1), w, Inches(0.35),
            size=Pt(11), bold=True, color=label_color, align=PP_ALIGN.CENTER)
    textbox(slide, value, x, y + Inches(0.4), w, h - Inches(0.4),
            size=Pt(22), bold=True, color=value_color, align=PP_ALIGN.CENTER)


# ── Slides ────────────────────────────────────────────────────────────────────

def slide_title(prs):
    """1 — Title"""
    s = add_slide(prs)
    rect(s, 0, 0, W, H, fill=NAVY)
    # Orange stripe left
    rect(s, 0, 0, Inches(0.5), H, fill=ORANGE)
    # Teal bottom stripe
    rect(s, 0, H - Inches(0.12), W, Inches(0.12), fill=TEAL)

    textbox(s, "SPEC-DRIVEN\nDEVELOPMENT",
            Inches(0.9), Inches(1.6), Inches(9), Inches(2.6),
            size=Pt(54), bold=True, color=WHITE)

    textbox(s, "Building the right thing — from README to running code",
            Inches(0.9), Inches(4.0), Inches(9.5), Inches(0.7),
            size=Pt(22), color=ORANGE, italic=True)

    textbox(s, "Worked example: Grafana Log Monitoring POC",
            Inches(0.9), Inches(4.85), Inches(9), Inches(0.5),
            size=Pt(16), color=MID_GRAY)

    textbox(s, "March 2026",
            Inches(0.9), Inches(5.4), Inches(4), Inches(0.4),
            size=Pt(13), color=MID_GRAY)


def slide_agenda(prs):
    """2 — Agenda"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 2)
    section_tag(s, "Overview")
    heading(s, "Agenda")

    items = [
        ("01", "What is Spec-Driven Development?"),
        ("02", "The Problem Without Specs"),
        ("03", "The SDD Workflow  (5 steps)"),
        ("04", "Worked Example: Grafana Log POC"),
        ("05", "From Spec → Code → Infrastructure → Dashboard"),
        ("06", "Benefits & Key Principles"),
    ]

    for i, (num, label) in enumerate(items):
        row_y = Inches(2.4) + i * Inches(0.72)
        rect(s, Inches(0.5), row_y, Inches(0.55), Inches(0.48), fill=ORANGE)
        textbox(s, num, Inches(0.5), row_y, Inches(0.55), Inches(0.48),
                size=Pt(14), bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        textbox(s, label, Inches(1.2), row_y + Pt(4), Inches(10), Inches(0.45),
                size=Pt(18), color=NAVY)


def slide_what_is_sdd(prs):
    """3 — What is SDD?"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 3)
    section_tag(s, "Definition")
    heading(s, "What is Spec-Driven Development?")

    # Definition box
    rect(s, Inches(0.5), Inches(2.45), Inches(12.3), Inches(1.3), fill=NAVY)
    textbox(s,
            "A development practice where a written specification (the \"spec\") is created\n"
            "BEFORE any code is written — and every implementation decision traces back to it.",
            Inches(0.7), Inches(2.55), Inches(11.9), Inches(1.1),
            size=Pt(18), color=WHITE, italic=True)

    # Three pillars
    pillars = [
        (ORANGE, "Spec First",       "The README (or spec doc)\nis the single source\nof truth"),
        (TEAL,   "Traceable",        "Every file, config, and\nfeature maps back\nto a spec item"),
        (NAVY,   "Verifiable",       "Done means spec is\nmet — not just\ncode committed"),
    ]
    for i, (color, title, body) in enumerate(pillars):
        x = Inches(0.5) + i * Inches(4.15)
        rect(s, x, Inches(4.0), Inches(3.9), Inches(2.8), fill=color)
        textbox(s, title, x, Inches(4.1), Inches(3.9), Inches(0.55),
                size=Pt(20), bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        rect(s, x + Inches(1.4), Inches(4.65), Inches(1.1), Inches(0.05), fill=WHITE)
        textbox(s, body, x, Inches(4.75), Inches(3.9), Inches(1.9),
                size=Pt(15), color=WHITE, align=PP_ALIGN.CENTER)


def slide_problem(prs):
    """4 — The Problem"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s, color=RGBColor(0xCC, 0x33, 0x33))
    bottom_bar(s)
    slide_number(s, 4)
    section_tag(s, "Problem", color=RGBColor(0xCC, 0x33, 0x33))
    heading(s, "Without a Spec — What Goes Wrong?")

    problems = [
        ("Scope creep",          "Features grow beyond original intent with no written boundary"),
        ("Misaligned expectations", "Dev builds X, stakeholder expected Y"),
        ("Rework",               "Code written before requirements are clear gets thrown away"),
        ("Knowledge silos",      "Only the original author knows what the system is supposed to do"),
        ("Impossible to test",   "No spec = no acceptance criteria = no way to say \"done\""),
    ]

    for i, (title, desc) in enumerate(problems):
        y = Inches(2.45) + i * Inches(0.88)
        rect(s, Inches(0.5), y, Inches(0.08), Inches(0.6),
             fill=RGBColor(0xCC, 0x33, 0x33))
        textbox(s, title, Inches(0.75), y, Inches(3.0), Inches(0.6),
                size=Pt(16), bold=True, color=NAVY)
        textbox(s, desc, Inches(3.9), y, Inches(8.9), Inches(0.6),
                size=Pt(15), color=GRAY)


def slide_workflow(prs):
    """5 — The SDD Workflow"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 5)
    section_tag(s, "Workflow")
    heading(s, "The Spec-Driven Workflow  (5 Steps)")

    steps = [
        (ORANGE, "01\nWrite\nthe Spec",    "Define what & why\nin README / spec doc"),
        (TEAL,   "02\nReview\n& Agree",   "Stakeholders sign off\nbefore code starts"),
        (NAVY,   "03\nImplement",         "Code traces directly\nto spec items"),
        (RGBColor(0x7B, 0x2F, 0xBF), "04\nVerify",  "Tests confirm spec\nis satisfied"),
        (RGBColor(0x1A, 0x7A, 0x4A), "05\nUpdate\nthe Spec", "Spec evolves with\nthe system"),
    ]

    arrow_color = MID_GRAY
    box_w = Inches(2.1)
    box_h = Inches(3.0)
    gap   = Inches(0.18)
    start_x = Inches(0.42)

    for i, (color, title, desc) in enumerate(steps):
        x = start_x + i * (box_w + gap)
        rect(s, x, Inches(2.3), box_w, box_h, fill=color)
        textbox(s, title,
                x, Inches(2.4), box_w, Inches(1.4),
                size=Pt(18), bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        # divider
        rect(s, x + Inches(0.3), Inches(3.7), box_w - Inches(0.6), Inches(0.04), fill=WHITE)
        textbox(s, desc,
                x, Inches(3.8), box_w, Inches(1.3),
                size=Pt(13), color=WHITE, align=PP_ALIGN.CENTER)
        # arrow (except after last)
        if i < len(steps) - 1:
            ax = x + box_w + Inches(0.02)
            textbox(s, "▶", ax, Inches(3.6), gap + Inches(0.1), Inches(0.4),
                    size=Pt(14), color=arrow_color, align=PP_ALIGN.CENTER)


def slide_poc_intro(prs):
    """6 — POC Introduction"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 6)
    section_tag(s, "Worked Example")
    heading(s, "Worked Example: Grafana Log Monitoring POC")

    # Left — what we built
    textbox(s, "The Spec", Inches(0.5), Inches(2.35), Inches(5.8), Inches(0.4),
            size=Pt(16), bold=True, color=ORANGE)
    bullet_box(s, [
        "README.md written first — full architecture, components, and log format defined",
        "3 simulated services: auth, payment, api-gateway",
        "Structured JSON logs with level / service / request_id",
        "Grafana dashboard panels specified before any JSON was written",
    ], Inches(0.5), Inches(2.8), Inches(5.8), Inches(3.2), size=Pt(15))

    # Divider
    rect(s, Inches(6.5), Inches(2.3), Inches(0.04), Inches(3.8), fill=MID_GRAY)

    # Right — architecture
    textbox(s, "Architecture", Inches(6.7), Inches(2.35), Inches(6.0), Inches(0.4),
            size=Pt(16), bold=True, color=TEAL)

    arch_items = [
        (ORANGE, "log_generator.py", "Python — emits JSON logs"),
        (TEAL,   "Promtail",         "Scrapes & ships logs"),
        (NAVY,   "Loki",             "Stores & indexes logs"),
        (RGBColor(0xF4, 0x6B, 0x00), "Grafana", "Visualizes with dashboard"),
    ]
    for i, (color, name, desc) in enumerate(arch_items):
        y = Inches(2.85) + i * Inches(0.82)
        rect(s, Inches(6.7), y, Inches(0.3), Inches(0.52), fill=color)
        textbox(s, name, Inches(7.1), y, Inches(2.5), Inches(0.52),
                size=Pt(15), bold=True, color=NAVY)
        textbox(s, desc, Inches(9.65), y, Inches(3.5), Inches(0.52),
                size=Pt(14), color=GRAY)
        if i < len(arch_items) - 1:
            textbox(s, "│", Inches(6.82), y + Inches(0.52), Inches(0.3), Inches(0.3),
                    size=Pt(14), color=MID_GRAY, align=PP_ALIGN.CENTER)


def slide_spec_readme(prs):
    """7 — The Spec (README)"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 7)
    section_tag(s, "Step 1 — Spec")
    heading(s, "Step 1: Write the Spec  (README as Source of Truth)")

    code = """\
# Jai-Github — Grafana Log POC

## Spec

### Log Generator (log_generator.py)
- Emits structured JSON log lines to ./logs/app.log
- Fields: timestamp, level (INFO/WARN/ERROR), service, message, request_id
- Simulates 3 services: auth-service, payment-service, api-gateway
- Random level distribution: ~70% INFO, ~20% WARN, ~10% ERROR

### Grafana Dashboard
- Log volume over time (bar chart)
- Log level breakdown (pie chart)
- Live log stream with label filters"""

    code_block(s, code, Inches(0.5), Inches(2.3), Inches(7.6), Inches(4.5), size=Pt(12))

    # Callouts
    callouts = [
        ("Outcome", "Clear\nAcceptance\nCriteria"),
        ("Benefit", "No guesswork\nfor devs"),
        ("Benefit", "Reviewable\nbefore commit 1"),
    ]
    for i, (label, val) in enumerate(callouts):
        y = Inches(2.3) + i * Inches(1.45)
        callout_box(s, label, val, Inches(8.35), y, Inches(4.45), Inches(1.3))


def slide_code(prs):
    """8 — From Spec to Code"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 8)
    section_tag(s, "Step 3 — Implement")
    heading(s, "Step 3: From Spec → Code  (log_generator.py)")

    # Spec requirement box
    rect(s, Inches(0.5), Inches(2.25), Inches(12.3), Inches(0.65), fill=TEAL)
    textbox(s,
            "Spec says:  \"Emits structured JSON log lines · level distribution ~70% INFO / ~20% WARN / ~10% ERROR\"",
            Inches(0.65), Inches(2.3), Inches(12.0), Inches(0.55),
            size=Pt(14), color=WHITE, italic=True)

    code = """\
SERVICES = ["auth-service", "payment-service", "api-gateway"]

# Weighted distribution: 70% INFO  20% WARN  10% ERROR
LEVEL_WEIGHTS = [("INFO", 70), ("WARN", 20), ("ERROR", 10)]
LEVELS = [level for level, w in LEVEL_WEIGHTS for _ in range(w)]

def make_log_entry() -> dict:
    return {
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "level":      random.choice(LEVELS),
        "service":    random.choice(SERVICES),
        "message":    random.choice(MESSAGES[level]),
        "request_id": uuid.uuid4().hex[:8],
    }"""

    code_block(s, code, Inches(0.5), Inches(3.05), Inches(8.0), Inches(3.75))

    # Spec → Code trace
    textbox(s, "Spec → Code Traceability", Inches(8.7), Inches(3.05), Inches(4.4), Inches(0.45),
            size=Pt(14), bold=True, color=NAVY)
    traces = [
        ("3 services", "SERVICES list"),
        ("JSON fields", "dict keys"),
        ("Level weights", "LEVEL_WEIGHTS"),
        ("request_id", "uuid.hex[:8]"),
    ]
    for i, (spec_item, code_item) in enumerate(traces):
        y = Inches(3.6) + i * Inches(0.77)
        rect(s, Inches(8.7), y, Inches(1.9), Inches(0.55), fill=TEAL)
        rect(s, Inches(10.75), y, Inches(2.35), Inches(0.55), fill=NAVY)
        textbox(s, spec_item, Inches(8.7), y, Inches(1.9), Inches(0.55),
                size=Pt(12), color=WHITE, align=PP_ALIGN.CENTER)
        textbox(s, "→", Inches(10.6), y + Pt(6), Inches(0.25), Inches(0.4),
                size=Pt(14), color=GRAY, align=PP_ALIGN.CENTER)
        textbox(s, code_item, Inches(10.75), y, Inches(2.35), Inches(0.55),
                size=Pt(12), color=WHITE, align=PP_ALIGN.CENTER, bold=True)


def slide_infra(prs):
    """9 — From Spec to Infrastructure"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 9)
    section_tag(s, "Step 3 — Infra")
    heading(s, "Step 3: From Spec → Infrastructure  (Docker Compose)")

    rect(s, Inches(0.5), Inches(2.25), Inches(12.3), Inches(0.65), fill=ORANGE)
    textbox(s,
            "Spec says:  \"Loki on port 3100 · Promtail watches ./logs/*.log · Grafana on port 3000 (admin/admin)\"",
            Inches(0.65), Inches(2.3), Inches(12.0), Inches(0.55),
            size=Pt(14), color=WHITE, italic=True)

    code = """\
services:
  loki:
    image: grafana/loki:2.9.4
    ports: ["3100:3100"]          # ← spec: port 3100
    volumes:
      - ./loki/loki-config.yml:/etc/loki/loki-config.yml:ro

  promtail:
    image: grafana/promtail:2.9.4
    volumes:
      - ./logs:/logs:ro           # ← spec: watches ./logs/*.log

  grafana:
    image: grafana/grafana:10.3.3
    ports: ["3000:3000"]          # ← spec: port 3000
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin  # ← spec: admin/admin"""

    code_block(s, code, Inches(0.5), Inches(3.05), Inches(8.2), Inches(4.0))

    textbox(s, "Every config value is\ntraced to a spec line",
            Inches(8.7), Inches(3.3), Inches(4.3), Inches(0.9),
            size=Pt(17), color=NAVY, italic=True)

    points = [
        "No surprise ports or passwords",
        "New team member reads spec\n→ understands the infra immediately",
        "Changes to infra require\na spec update first",
    ]
    bullet_box(s, points, Inches(8.7), Inches(4.3), Inches(4.3), Inches(2.5),
               size=Pt(14), color=NAVY)


def slide_dashboard(prs):
    """10 — From Spec to Dashboard"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 10)
    section_tag(s, "Step 3 — Dashboard")
    heading(s, "Step 3: From Spec → Dashboard  (Grafana JSON)")

    rect(s, Inches(0.5), Inches(2.25), Inches(12.3), Inches(0.65), fill=NAVY)
    textbox(s,
            "Spec says:  \"Log volume over time (bar) · Log level breakdown (pie) · Live log stream with label filters\"",
            Inches(0.65), Inches(2.3), Inches(12.0), Inches(0.55),
            size=Pt(14), color=WHITE, italic=True)

    panels = [
        (ORANGE, "Log Volume\nOver Time", "Bar chart\nby level\n(INFO/WARN/ERROR)"),
        (TEAL,   "Level\nBreakdown",      "Donut chart\n% per level\nlast 1 hour"),
        (NAVY,   "Error Rate\n/min",      "Stat panel\nwith threshold\ncoloring"),
        (RGBColor(0x7B, 0x2F, 0xBF), "Live Log\nStream",  "Real-time\nlog viewer\nwith filters"),
    ]

    for i, (color, title, desc) in enumerate(panels):
        x = Inches(0.5) + i * Inches(3.18)
        rect(s, x, Inches(3.05), Inches(2.9), Inches(1.4), fill=color)
        textbox(s, title, x, Inches(3.08), Inches(2.9), Inches(1.35),
                size=Pt(16), bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        rect(s, x, Inches(4.45), Inches(2.9), Inches(2.2), fill=LIGHT_BG,
             line=color, line_width=Pt(2))
        textbox(s, desc, x, Inches(4.5), Inches(2.9), Inches(2.1),
                size=Pt(14), color=GRAY, align=PP_ALIGN.CENTER)

    textbox(s, "Each panel was specified before dashboard.json was created",
            Inches(0.5), Inches(6.8), Inches(12.3), Inches(0.4),
            size=Pt(14), color=GRAY, italic=True, align=PP_ALIGN.CENTER)


def slide_benefits(prs):
    """11 — Benefits"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 11)
    section_tag(s, "Benefits")
    heading(s, "Benefits for Everyone")

    # Dev column
    rect(s, Inches(0.5), Inches(2.3), Inches(5.9), Inches(4.6), fill=NAVY)
    textbox(s, "For Developers", Inches(0.5), Inches(2.4), Inches(5.9), Inches(0.5),
            size=Pt(19), bold=True, color=ORANGE, align=PP_ALIGN.CENTER)
    rect(s, Inches(1.5), Inches(2.9), Inches(3.9), Inches(0.04), fill=ORANGE)
    dev_items = [
        "Clear requirements before writing line 1",
        "No second-guessing intent",
        "Easier code reviews — reviewer checks spec",
        "Onboarding: read the spec, understand the system",
        "Spec-driven tests = clear acceptance criteria",
    ]
    bullet_box(s, dev_items, Inches(0.7), Inches(3.0), Inches(5.5), Inches(3.7),
               size=Pt(14), color=WHITE, bullet="✓")

    # Manager column
    rect(s, Inches(6.6), Inches(2.3), Inches(6.2), Inches(4.6), fill=TEAL)
    textbox(s, "For Managers & Stakeholders", Inches(6.6), Inches(2.4), Inches(6.2), Inches(0.5),
            size=Pt(19), bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    rect(s, Inches(7.8), Inches(2.9), Inches(3.9), Inches(0.04), fill=WHITE)
    mgr_items = [
        "Review & approve before any dev time spent",
        "Scope is locked in writing — fewer surprises",
        "Progress is measurable against spec items",
        "Handoffs are clean — spec is the documentation",
        "Faster delivery — less rework, less re-explaining",
    ]
    bullet_box(s, mgr_items, Inches(6.8), Inches(3.0), Inches(5.9), Inches(3.7),
               size=Pt(14), color=WHITE, bullet="✓")


def slide_principles(prs):
    """12 — Key Principles"""
    s = add_slide(prs)
    slide_bg(s)
    accent_bar(s)
    bottom_bar(s)
    slide_number(s, 12)
    section_tag(s, "Principles")
    heading(s, "Key Principles")

    principles = [
        (ORANGE, "Spec Before Code",         "No line of code is written without a spec item to point to"),
        (TEAL,   "Living Document",           "The spec evolves WITH the system — it's never abandoned"),
        (NAVY,   "Single Source of Truth",    "README (or spec doc) is the authoritative record"),
        (RGBColor(0x7B, 0x2F, 0xBF), "Small & Iterative",  "Spec one slice at a time — ship, learn, update"),
        (RGBColor(0x1A, 0x7A, 0x4A), "Shared Ownership",   "Everyone (dev, PM, QA) contributed to and owns the spec"),
    ]

    for i, (color, title, desc) in enumerate(principles):
        y = Inches(2.45) + i * Inches(0.88)
        rect(s, Inches(0.5), y, Inches(0.5), Inches(0.65), fill=color)
        textbox(s, title, Inches(1.15), y + Pt(4), Inches(3.7), Inches(0.65),
                size=Pt(16), bold=True, color=NAVY)
        textbox(s, desc, Inches(5.1), y + Pt(4), Inches(7.7), Inches(0.65),
                size=Pt(15), color=GRAY)


def slide_closing(prs):
    """13 — Closing"""
    s = add_slide(prs)
    rect(s, 0, 0, W, H, fill=NAVY)
    rect(s, 0, 0, Inches(0.5), H, fill=ORANGE)
    rect(s, 0, H - Inches(0.12), W, Inches(0.12), fill=TEAL)

    textbox(s, "WRITE THE SPEC FIRST.",
            Inches(0.9), Inches(1.5), Inches(11.5), Inches(1.1),
            size=Pt(52), bold=True, color=WHITE)

    textbox(s, "Then build exactly what you specified.",
            Inches(0.9), Inches(2.75), Inches(10), Inches(0.65),
            size=Pt(26), color=ORANGE, italic=True)

    # Repo box
    rect(s, Inches(0.9), Inches(3.7), Inches(6.5), Inches(1.3), fill=RGBColor(0x2A, 0x3A, 0x4E))
    textbox(s, "POC Repo",
            Inches(1.05), Inches(3.75), Inches(2.0), Inches(0.5),
            size=Pt(12), color=ORANGE)
    textbox(s, "github.com/jaij52/Jai-Github",
            Inches(1.05), Inches(4.1), Inches(6.1), Inches(0.65),
            size=Pt(18), bold=True, color=WHITE)

    textbox(s, "Stack: Python  ·  Loki  ·  Promtail  ·  Grafana\ndocker compose up -d  →  python log_generator.py",
            Inches(0.9), Inches(5.25), Inches(10), Inches(0.9),
            size=Pt(16), color=MID_GRAY)

    textbox(s, "Questions?",
            Inches(9.5), Inches(5.8), Inches(3.5), Inches(0.8),
            size=Pt(28), bold=True, color=TEAL, align=PP_ALIGN.RIGHT)


# ── Main ──────────────────────────────────────────────────────────────────────

def build():
    prs = Presentation()
    prs.slide_width  = W
    prs.slide_height = H

    slide_title(prs)
    slide_agenda(prs)
    slide_what_is_sdd(prs)
    slide_problem(prs)
    slide_workflow(prs)
    slide_poc_intro(prs)
    slide_spec_readme(prs)
    slide_code(prs)
    slide_infra(prs)
    slide_dashboard(prs)
    slide_benefits(prs)
    slide_principles(prs)
    slide_closing(prs)

    os.makedirs("presentation", exist_ok=True)
    out = "presentation/spec-driven-development.pptx"
    prs.save(out)
    print(f"Saved: {out}  ({len(prs.slides)} slides)")


if __name__ == "__main__":
    build()
