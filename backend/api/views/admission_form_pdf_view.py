from io import BytesIO
import os

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings

from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, Image, PageBreak, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus.flowables import Flowable

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import requests

from apps.admissions.models import Admission


# ─────────────────────────────────────────────────────────────────────────────
# Colour palette  — refined, modern
# ─────────────────────────────────────────────────────────────────────────────

NAVY        = colors.HexColor("#0f2d6b")   # deep navy – primary
BLUE        = colors.HexColor("#1e40af")   # mid blue
LBLUE       = colors.HexColor("#dbeafe")   # pale blue tint
MBLUE       = colors.HexColor("#93c5fd")   # medium blue
ACCENT      = colors.HexColor("#f59e0b")   # amber/gold accent
ACCENT_DARK = colors.HexColor("#b45309")
TEAL        = colors.HexColor("#0d9488")   # secondary accent
LTEAL       = colors.HexColor("#ccfbf1")

GREEN       = colors.HexColor("#16a34a")
LGREEN      = colors.HexColor("#dcfce7")
RED         = colors.HexColor("#dc2626")
LRED        = colors.HexColor("#fee2e2")
ORANGE      = colors.HexColor("#ea580c")
LORANGE     = colors.HexColor("#ffedd5")

WHITE       = colors.white
OFF_WHITE   = colors.HexColor("#f8fafc")
GRAY_50     = colors.HexColor("#f9fafb")
GRAY_100    = colors.HexColor("#f3f4f6")
GRAY_200    = colors.HexColor("#e5e7eb")
GRAY_400    = colors.HexColor("#9ca3af")
GRAY_600    = colors.HexColor("#4b5563")
GRAY_800    = colors.HexColor("#1f2937")
BLACK       = colors.HexColor("#0f172a")

LOGO_PATH = os.path.join(settings.BASE_DIR, "static", "images", "logo.jpeg")

PW = A4[0] - 32 * mm   # usable page width (16 mm margins each side)
PAGE_H = A4[1]


# ─────────────────────────────────────────────────────────────────────────────
# Custom Flowables
# ─────────────────────────────────────────────────────────────────────────────

class RoundedBox(Flowable):
    """A filled rounded-rectangle background block."""
    def __init__(self, width, height, fill_color, stroke_color=None,
                 radius=3, stroke_width=0.5):
        super().__init__()
        self.width       = width
        self.height      = height
        self.fill_color  = fill_color
        self.stroke_color = stroke_color or fill_color
        self.radius      = radius
        self.stroke_width = stroke_width

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(self.fill_color)
        c.setStrokeColor(self.stroke_color)
        c.setLineWidth(self.stroke_width)
        c.roundRect(0, 0, self.width, self.height, self.radius, fill=1,
                    stroke=1 if self.stroke_color != self.fill_color else 0)
        c.restoreState()


class ColorBar(Flowable):
    """A thin decorative horizontal colour bar."""
    def __init__(self, width, height=1.2 * mm, colors_list=None):
        super().__init__()
        self.width = width
        self.height = height
        self.colors_list = colors_list or [NAVY, BLUE, ACCENT]

    def draw(self):
        c = self.canv
        seg_w = self.width / len(self.colors_list)
        for i, col in enumerate(self.colors_list):
            c.setFillColor(col)
            c.rect(i * seg_w, 0, seg_w, self.height, fill=1, stroke=0)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_image_flowable(path_or_url, width, height):
    try:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            resp = requests.get(path_or_url, timeout=5)
            resp.raise_for_status()
            return Image(BytesIO(resp.content), width=width, height=height)
        if os.path.exists(path_or_url):
            return Image(path_or_url, width=width, height=height)
    except Exception:
        pass
    return None


def load_logo():
    return load_image_flowable(LOGO_PATH, width=20 * mm, height=20 * mm)


def load_admission_photo(admission, width=28 * mm, height=34 * mm):
    try:
        if not admission.photo:
            return None
        photo_url = admission.photo.url
        if not photo_url.startswith("http"):
            photo_path = os.path.join(settings.MEDIA_ROOT, str(admission.photo))
            return load_image_flowable(photo_path, width=width, height=height)
        return load_image_flowable(photo_url, width=width, height=height)
    except Exception:
        pass
    return None


def _style(size=9, bold=False, color=GRAY_800, align=TA_LEFT,
           leading=None, space_after=0, italic=False):
    font = "Helvetica-BoldOblique" if bold and italic else \
           "Helvetica-Bold" if bold else \
           "Helvetica-Oblique" if italic else "Helvetica"
    return ParagraphStyle(
        "p",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=size,
        fontName=font,
        textColor=color,
        alignment=align,
        leading=leading or (size + 5),
        spaceAfter=space_after,
    )


def para(text, size=9, bold=False, color=GRAY_800, align=TA_LEFT,
         leading=None, space_after=0, italic=False):
    return Paragraph(str(text), _style(size, bold, color, align, leading, space_after, italic))


def divider(color=GRAY_200, thickness=0.6):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=0, spaceBefore=0)


def label_value_row(label, value, label_w=50 * mm, value_w=None, label_color=BLUE,
                    row_bg=WHITE, alt_row_bg=None):
    vw = value_w or (PW - label_w)
    row = [
        para(label, 8, bold=True, color=label_color),
        para(str(value) if value else "—", 8, color=GRAY_800),
    ]
    t = Table([row], colWidths=[label_w, vw])
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("BACKGROUND",    (0, 0), (-1, -1), row_bg),
    ]))
    return t


# ─────────────────────────────────────────────────────────────────────────────
# Page-level canvas decorations (watermark + page number)
# ─────────────────────────────────────────────────────────────────────────────

def _on_page(canvas, doc):
    """Called for every page — adds subtle watermark text and page number."""
    canvas.saveState()

    # Faint diagonal watermark
    canvas.setFont("Helvetica-Bold", 42)
    canvas.setFillColor(colors.HexColor("#e8edf5"))
    canvas.setFillAlpha(0.35)
    canvas.translate(A4[0] / 2, A4[1] / 2)
    canvas.rotate(38)
    canvas.drawCentredString(0, 0, "LEADING STARS ACADEMY")
    canvas.setFillAlpha(1.0)

    # Thin top accent stripe
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - 3, A4[0], 3, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, A4[1] - 5.5, A4[0], 2.5, fill=1, stroke=0)

    # Bottom bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], 4, fill=1, stroke=0)

    # Page number
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_400)
    canvas.drawCentredString(A4[0] / 2, 6,
                             f"Page {doc.page}  •  Leading Stars Academy  •  Confidential")

    canvas.restoreState()


# ─────────────────────────────────────────────────────────────────────────────
# PAGE 1 — Header
# ─────────────────────────────────────────────────────────────────────────────

def build_page1_header(admission):
    logo_img   = load_logo()
    logo_cell  = logo_img if logo_img else para("★", 18, bold=True, color=WHITE, align=TA_CENTER)

    admission_no = admission.admission_number or "PENDING"
    date_str = (admission.application_date.strftime("%d %B %Y")
                if admission.application_date else "")

    # Left: logo
    left = Table([[logo_cell]], colWidths=[24 * mm])
    left.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    # Centre: school name block
    centre_content = [
        para("LEADING STARS ACADEMY", 15, bold=True, color=WHITE, align=TA_CENTER),
        para("WHERE LEADERS ARE BORN", 7, color=MBLUE, align=TA_CENTER, italic=True),
        Spacer(1, 2 * mm),
        para("ADMISSION FORM", 12, bold=True, color=ACCENT, align=TA_CENTER),
    ]
    centre = Table([[centre_content]], colWidths=[122 * mm])
    centre.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    # Right: ref + date
    right_content = [
        para("Ref. No.", 7, color=MBLUE, align=TA_RIGHT),
        para(admission_no, 9, bold=True, color=WHITE, align=TA_RIGHT),
        Spacer(1, 3 * mm),
        para("Date Applied", 7, color=MBLUE, align=TA_RIGHT),
        para(date_str, 8, color=colors.HexColor("#e0e7ff"), align=TA_RIGHT),
    ]
    right = Table([[right_content]], colWidths=[36 * mm])
    right.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))

    outer = Table([[left, centre, right]], colWidths=[24 * mm, 122 * mm, 36 * mm])
    outer.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (0, 0),   6),
        ("RIGHTPADDING",  (-1, 0), (-1, 0), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer


# ─────────────────────────────────────────────────────────────────────────────
# Status badge
# ─────────────────────────────────────────────────────────────────────────────

def build_status_badge(admission):
    status_map = {
        "approved": ("✓   ADMISSION APPROVED",  GREEN,  LGREEN,  GREEN),
        "rejected": ("✗   ADMISSION REJECTED",  RED,    LRED,    RED),
        "pending":  ("●   APPLICATION PENDING", ORANGE, LORANGE, ORANGE),
    }
    text, fg, bg, border = status_map.get(
        admission.status, ("●   APPLICATION PENDING", ORANGE, LORANGE, ORANGE)
    )

    inner = Table(
        [[para(text, 10, bold=True, color=fg, align=TA_CENTER)]],
        colWidths=[PW - 4 * mm],
    )
    inner.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg),
        ("BOX",           (0, 0), (-1, -1), 1.2, border),
        ("ROUNDEDCORNERS", [3]),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))

    outer = Table([[inner]], colWidths=[PW])
    outer.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING",   (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 2 * mm),
    ]))
    return outer


# ─────────────────────────────────────────────────────────────────────────────
# Section header — with left accent stripe
# ─────────────────────────────────────────────────────────────────────────────

def build_section_header(title, icon=""):
    label = f"{icon}  {title}".strip() if icon else title

    # accent stripe + title side by side
    stripe = Table([[""]],  colWidths=[3 * mm], rowHeights=[8 * mm])
    stripe.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ACCENT),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    title_cell = Table(
        [[para(label, 9, bold=True, color=WHITE)]],
        colWidths=[PW - 3 * mm],
    )
    title_cell.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
    ]))

    combined = Table([[stripe, title_cell]], colWidths=[3 * mm, PW - 3 * mm])
    combined.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return combined


# ─────────────────────────────────────────────────────────────────────────────
# Photo card
# ─────────────────────────────────────────────────────────────────────────────

def build_photo_card(admission):
    photo = load_admission_photo(admission)

    if photo:
        photo_cell = photo
    else:
        # Placeholder with initials
        initials = (
            (admission.first_name or " ")[0].upper() +
            (admission.last_name  or " ")[0].upper()
        )
        photo_cell = para(initials, 16, bold=True, color=BLUE, align=TA_CENTER)

    inner = Table([[photo_cell]], colWidths=[30 * mm], rowHeights=[36 * mm])
    inner.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND",    (0, 0), (-1, -1), LBLUE),
        ("BOX",           (0, 0), (-1, -1), 2.0, BLUE),
    ]))

    label = Table(
        [[para("STUDENT PHOTO", 6, bold=True, color=GRAY_400, align=TA_CENTER)]],
        colWidths=[30 * mm],
    )
    label.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY_100),
        ("BOX",           (0, 0), (-1, -1), 0.5, GRAY_200),
    ]))

    wrapper = Table([[inner], [label]], colWidths=[30 * mm])
    wrapper.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    return wrapper


# ─────────────────────────────────────────────────────────────────────────────
# Student info section
# ─────────────────────────────────────────────────────────────────────────────

def build_student_section(admission):
    class_name = admission.applied_class.name if admission.applied_class else "—"
    dob = admission.date_of_birth.strftime("%d %B %Y") if admission.date_of_birth else "—"

    left_rows = [
        ("Full Name",       f"{admission.first_name} {admission.last_name}".strip() or "—"),
        ("Gender",          admission.gender         or "—"),
        ("Date of Birth",   dob),
        ("Nationality",     admission.nationality    or "—"),
    ]
    right_rows = [
        ("Religion",        admission.religion       or "—"),
        ("Applied Class",   class_name),
        ("Previous School", admission.previous_school or "—"),
        ("Health Notes",    admission.health_notes   or "None"),
    ]

    def info_table(rows, cw1=42 * mm, cw2=46 * mm):
        tbl_rows = []
        for i, (lbl, val) in enumerate(rows):
            bg = WHITE if i % 2 == 0 else GRAY_50
            tbl_rows.append([
                para(lbl, 8, bold=True, color=NAVY),
                para(val, 8, color=GRAY_800),
            ])
        t = Table(tbl_rows, colWidths=[cw1, cw2])
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.4, GRAY_200),
            # Alternating row backgrounds
            *[("BACKGROUND", (0, i), (-1, i),
               WHITE if i % 2 == 0 else GRAY_50)
              for i in range(len(rows))],
        ]))
        return t

    left_tbl  = info_table(left_rows)
    right_tbl = info_table(right_rows)
    photo     = build_photo_card(admission)

    combined = Table(
        [[left_tbl, right_tbl, photo]],
        colWidths=[88 * mm, 88 * mm, 36 * mm],
    )
    combined.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("BOX",           (0, 0), (-1, -1), 0.8, GRAY_200),
        ("LINEAFTER",     (0, 0), (1, 0),   0.4, GRAY_200),
        ("BACKGROUND",    (2, 0), (2, 0),   GRAY_50),
        ("ALIGN",         (2, 0), (2, 0),   "CENTER"),
        ("VALIGN",        (2, 0), (2, 0),   "MIDDLE"),
        ("TOPPADDING",    (2, 0), (2, 0),   6),
        ("BOTTOMPADDING", (2, 0), (2, 0),   6),
    ]))
    return combined


# ─────────────────────────────────────────────────────────────────────────────
# Parent / guardian section
# ─────────────────────────────────────────────────────────────────────────────

def build_parent_section(admission):
    rows = [
        ("Parent / Guardian Name", admission.parent_name   or "—"),
        ("Relationship",           admission.relationship  or "—"),
        ("Gender",                 admission.parent_gender or "—"),
        ("Phone",                  admission.phone         or "—"),
        ("Alt. Phone",             admission.alt_phone     or "—"),
        ("Email",                  admission.email         or "—"),
        ("Home Address",           admission.address       or "—"),
    ]

    tbl_rows = []
    for i, (lbl, val) in enumerate(rows):
        tbl_rows.append([
            para(lbl, 8, bold=True, color=NAVY),
            para(val, 8, color=GRAY_800),
        ])

    tbl = Table(tbl_rows, colWidths=[52 * mm, PW - 52 * mm])
    tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.4, GRAY_200),
        ("BOX",           (0, 0), (-1, -1), 0.8, GRAY_200),
        *[("BACKGROUND", (0, i), (-1, i),
           WHITE if i % 2 == 0 else GRAY_50)
          for i in range(len(rows))],
    ]))
    return tbl


# ─────────────────────────────────────────────────────────────────────────────
# Footer note
# ─────────────────────────────────────────────────────────────────────────────

def build_footer_note():
    content = Table([[
        para(
            "This is an official admission record of Leading Stars Academy.  "
            "Please retain a copy for your records.  "
            "For enquiries call the school office.",
            7, color=GRAY_400, align=TA_CENTER, italic=True,
        )
    ]], colWidths=[PW])
    content.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return content


# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — Acceptance Form
# ─────────────────────────────────────────────────────────────────────────────

def build_acceptance_header():
    logo_img  = load_logo()
    logo_cell = logo_img if logo_img else para("★", 18, bold=True, color=WHITE, align=TA_CENTER)

    centre_content = [
        para("LEADING STARS ACADEMY", 15, bold=True, color=WHITE, align=TA_CENTER),
        para("WHERE LEADERS ARE BORN", 7, color=MBLUE, align=TA_CENTER, italic=True),
        Spacer(1, 2 * mm),
        para("ACCEPTANCE FORM", 12, bold=True, color=ACCENT, align=TA_CENTER),
        para("To be signed and returned to the school office within 14 days",
             8, color=colors.HexColor("#c7d2fe"), align=TA_CENTER, italic=True),
    ]

    tbl = Table([[logo_cell, centre_content, para("", 9)]],
                colWidths=[24 * mm, 142 * mm, 16 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (0, 0),   8),
    ]))
    return tbl


def build_intro_text(admission):
    class_name = admission.applied_class.name if admission.applied_class else "the applied class"
    name = f"{admission.first_name} {admission.last_name}".strip() or "the above-named student"

    intro = (
        f"I/We, the undersigned parent/guardian of <b>{name}</b>, hereby accept the offer of "
        f"admission to <b>{class_name}</b> at <b>Leading Stars Academy</b> and agree to abide "
        f"by all school rules, regulations, and fee payment obligations as outlined in the "
        f"school&#x2019;s handbook."
    )
    style = ParagraphStyle(
        "intro",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=9.5, fontName="Helvetica",
        textColor=GRAY_800, leading=16, spaceAfter=0,
    )

    # Accent bar on the left
    bar = Table([[""]], colWidths=[4 * mm], rowHeights=[None])
    bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    text_cell = Table([[Paragraph(intro, style)]], colWidths=[PW - 4 * mm])
    text_cell.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LTEAL),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))

    combined = Table([[bar, text_cell]], colWidths=[4 * mm, PW - 4 * mm])
    combined.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "STRETCH"),
        ("BOX",           (0, 0), (-1, -1), 0.8, TEAL),
    ]))
    return combined


# ─────────────────────────────────────────────────────────────────────────────
# Signature fields helper
# ─────────────────────────────────────────────────────────────────────────────

def _sig_field(label, width, tall=False):
    """Returns a (line + label) pair of tables."""
    h = 28 * mm if tall else 20 * mm
    line = Table([[""]], colWidths=[width], rowHeights=[h])
    line.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, -1), 1.2, GRAY_800),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    lbl = Table(
        [[para(label, 7, color=GRAY_400, italic=True)]],
        colWidths=[width],
    )
    lbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 2),
    ]))
    return line, lbl


def build_signature_section():
    elements = []
    GAP = 6 * mm

    # ── Parent / Guardian declaration ────────────────────────────────────────
    elements.append(build_section_header("PARENT / GUARDIAN DECLARATION"))
    elements.append(Spacer(1, GAP))

    # Row 1: Name + Relationship
    n_line, n_lbl = _sig_field("Full Name of Parent / Guardian", PW / 2 - 3 * mm)
    r_line, r_lbl = _sig_field("Relationship to Student",        PW / 2 - 3 * mm)
    row1 = Table([[n_line, Spacer(6 * mm, 1), r_line]], colWidths=[PW / 2 - 3 * mm, 6 * mm, PW / 2 - 3 * mm])
    row1.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                               ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                               ("TOPPADDING",    (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    lbl1 = Table([[n_lbl, Spacer(6 * mm, 1), r_lbl]], colWidths=[PW / 2 - 3 * mm, 6 * mm, PW / 2 - 3 * mm])
    lbl1.setStyle(TableStyle([("LEFTPADDING",   (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                               ("TOPPADDING",    (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    elements += [row1, lbl1, Spacer(1, GAP)]

    # Row 2: Phone + Email
    ph_line, ph_lbl = _sig_field("Phone Number",  PW / 2 - 3 * mm)
    em_line, em_lbl = _sig_field("Email Address", PW / 2 - 3 * mm)
    row2 = Table([[ph_line, Spacer(6 * mm, 1), em_line]], colWidths=[PW / 2 - 3 * mm, 6 * mm, PW / 2 - 3 * mm])
    row2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                               ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                               ("TOPPADDING",    (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    lbl2 = Table([[ph_lbl, Spacer(6 * mm, 1), em_lbl]], colWidths=[PW / 2 - 3 * mm, 6 * mm, PW / 2 - 3 * mm])
    lbl2.setStyle(TableStyle([("LEFTPADDING",   (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                               ("TOPPADDING",    (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    elements += [row2, lbl2, Spacer(1, GAP)]

    # Row 3: Signature (wide) + Date (narrow)
    sg_line, sg_lbl = _sig_field("Signature of Parent / Guardian", PW * 0.62, tall=True)
    dt_line, dt_lbl = _sig_field("Date",                           PW * 0.34, tall=True)
    row3 = Table([[sg_line, Spacer(4 * mm, 1), dt_line]], colWidths=[PW * 0.62, 4 * mm, PW * 0.34])
    row3.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                               ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                               ("TOPPADDING",    (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    lbl3 = Table([[sg_lbl, Spacer(4 * mm, 1), dt_lbl]], colWidths=[PW * 0.62, 4 * mm, PW * 0.34])
    lbl3.setStyle(TableStyle([("LEFTPADDING",   (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                               ("TOPPADDING",    (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    elements += [row3, lbl3]

    elements.append(Spacer(1, 10 * mm))
    elements.append(divider(GRAY_200, 0.8))
    elements.append(Spacer(1, 8 * mm))

    # ── School declaration ────────────────────────────────────────────────────
    elements.append(build_section_header("FOR OFFICIAL USE  —  SCHOOL DECLARATION"))
    elements.append(Spacer(1, GAP))

    declaration = (
        "This is to certify that the above-named student has been duly admitted to "
        "Leading Stars Academy and is entitled to all the rights and privileges of a "
        "student of this institution, subject to compliance with all school regulations."
    )
    decl_style = ParagraphStyle(
        "decl",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=9, fontName="Helvetica",
        textColor=GRAY_800, leading=15,
    )
    decl_box = Table([[Paragraph(declaration, decl_style)]], colWidths=[PW])
    decl_box.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.8, GRAY_200),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY_50),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    elements.append(decl_box)
    elements.append(Spacer(1, GAP))

    # Principal sig + stamp + date
    pr_line, pr_lbl = _sig_field("Signature of Principal / Head Teacher", PW * 0.38, tall=True)
    st_line, st_lbl = _sig_field("Official School Stamp",                 PW * 0.30, tall=True)
    pd_line, pd_lbl = _sig_field("Date",                                  PW * 0.26, tall=True)

    pr_row = Table(
        [[pr_line, Spacer(2 * mm, 1), st_line, Spacer(2 * mm, 1), pd_line]],
        colWidths=[PW * 0.38, 2 * mm, PW * 0.30, 2 * mm, PW * 0.26],
    )
    pr_row.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    pr_lbl_row = Table(
        [[pr_lbl, Spacer(2 * mm, 1), st_lbl, Spacer(2 * mm, 1), pd_lbl]],
        colWidths=[PW * 0.38, 2 * mm, PW * 0.30, 2 * mm, PW * 0.26],
    )
    pr_lbl_row.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements += [pr_row, pr_lbl_row]
    elements.append(Spacer(1, 8 * mm))

    # Stamp placeholder box (right-aligned)
    stamp = Table(
        [[para("OFFICIAL\nSTAMP", 8, color=GRAY_400, bold=True, align=TA_CENTER)]],
        colWidths=[48 * mm],
        rowHeights=[32 * mm],
    )
    stamp.setStyle(TableStyle([
        ("BOX",    (0, 0), (-1, -1), 1.2, GRAY_300 if hasattr(colors, 'GRAY_300') else GRAY_200),
        ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
    ]))
    stamp_row = Table([[para("", 1), stamp]], colWidths=[PW - 52 * mm, 52 * mm])
    stamp_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))
    elements.append(stamp_row)

    return elements


# ─────────────────────────────────────────────────────────────────────────────
# Acceptance footer bullets
# ─────────────────────────────────────────────────────────────────────────────

def build_acceptance_footer():
    lines = [
        ("⚠", "This form must be signed and returned to the school office within 14 days of the offer."),
        ("⚠", "Failure to return this form may result in the admission offer being withdrawn."),
        ("✓", "Please retain the yellow copy for your own records."),
    ]
    rows = []
    for icon, text in lines:
        rows.append([
            para(icon, 8, bold=True, color=ACCENT),
            para(text, 7.5, color=GRAY_600),
        ])

    tbl = Table(rows, colWidths=[8 * mm, PW - 8 * mm])
    tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (0, -1),  8),
        ("LEFTPADDING",   (1, 0), (1, -1),  4),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, GRAY_200),
        ("BOX",           (0, 0), (-1, -1), 0.8, GRAY_200),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY_50),
        ("LINEBEFORE",    (0, 0), (0, -1),  3.5, ACCENT),
    ]))
    return tbl


# ─────────────────────────────────────────────────────────────────────────────
# View
# ─────────────────────────────────────────────────────────────────────────────

class AdmissionFormPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, admission_id):
        admission = get_object_or_404(
            Admission.objects.select_related("applied_class"),
            id=admission_id,
        )

        if admission.status != "approved":
            return Response(
                {"error": "Admission form is only available for approved applications."},
                status=400,
            )

        buffer = BytesIO()
        pdf = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
        )

        elements = []

        # ── PAGE 1: Admission details ────────────────────────────────────────
        elements.append(build_page1_header(admission))
        elements.append(ColorBar(PW, 2 * mm, [NAVY, BLUE, TEAL, ACCENT]))
        elements.append(Spacer(1, 5 * mm))
        elements.append(build_status_badge(admission))
        elements.append(Spacer(1, 6 * mm))

        elements.append(build_section_header("STUDENT INFORMATION"))
        elements.append(Spacer(1, 1.5 * mm))
        elements.append(build_student_section(admission))
        elements.append(Spacer(1, 6 * mm))

        elements.append(build_section_header("PARENT / GUARDIAN INFORMATION"))
        elements.append(Spacer(1, 1.5 * mm))
        elements.append(build_parent_section(admission))
        elements.append(Spacer(1, 10 * mm))

        elements.append(divider(GRAY_200))
        elements.append(Spacer(1, 3 * mm))
        elements.append(build_footer_note())

        # ── PAGE 2: Acceptance form ──────────────────────────────────────────
        elements.append(PageBreak())

        elements.append(build_acceptance_header())
        elements.append(ColorBar(PW, 2 * mm, [NAVY, BLUE, TEAL, ACCENT]))
        elements.append(Spacer(1, 7 * mm))
        elements.append(build_intro_text(admission))
        elements.append(Spacer(1, 9 * mm))

        elements += build_signature_section()

        elements.append(Spacer(1, 7 * mm))
        elements.append(divider(GRAY_200))
        elements.append(Spacer(1, 4 * mm))
        elements.append(build_acceptance_footer())

        pdf.build(elements, onFirstPage=_on_page, onLaterPages=_on_page)
        buffer.seek(0)

        name_slug = (
            f"{admission.first_name}_{admission.last_name}"
            .strip("_").replace(" ", "_")
        )
        filename = f"admission_form_{name_slug}.pdf"

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response