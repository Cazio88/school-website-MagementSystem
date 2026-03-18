from io import BytesIO
import os

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings

from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, Image, PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import requests

from apps.admissions.models import Admission

# ─────────────────────────────────────────────────────────────────────────────
# Colour palette  (matches bill_pdf_view)
# ─────────────────────────────────────────────────────────────────────────────

BLUE   = colors.HexColor("#1e40af")
LBLUE  = colors.HexColor("#dbeafe")
MBLUE  = colors.HexColor("#bfdbfe")
GRAY   = colors.HexColor("#f9fafb")
MGRAY  = colors.HexColor("#f3f4f6")
DGRAY  = colors.HexColor("#374151")
LGRAY  = colors.HexColor("#9ca3af")
WHITE  = colors.white
GOLD   = colors.HexColor("#d97706")
GREEN  = colors.HexColor("#16a34a")
LGREEN = colors.HexColor("#dcfce7")
BLACK  = colors.HexColor("#111827")
SILVER = colors.HexColor("#e5e7eb")

LOGO_PATH = os.path.join(settings.BASE_DIR, "static", "images", "logo.jpeg")

PW = A4[0] - 32 * mm   # usable page width (16 mm margins each side)


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
    return load_image_flowable(LOGO_PATH, width=18 * mm, height=18 * mm)


def load_admission_photo(admission, width=28 * mm, height=32 * mm):
    """
    Load the student photo from Cloudinary.
    admission.photo is a CloudinaryField — .url gives the full CDN URL.
    Falls back gracefully if photo is missing or unreachable.
    """
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


def para(text, size=9, bold=False, color=DGRAY, align=TA_LEFT):
    return Paragraph(str(text), ParagraphStyle(
        "p",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=size,
        fontName="Helvetica-Bold" if bold else "Helvetica",
        textColor=color,
        alignment=align,
        leading=size + 4,
        spaceAfter=0,
    ))


def divider():
    return HRFlowable(width="100%", thickness=0.5, color=SILVER)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE 1 — Admission Details
# ─────────────────────────────────────────────────────────────────────────────

def build_page1_header(admission):
    """Blue banner: logo | school name + ADMISSION FORM | date applied."""
    logo_cell = load_logo() or para("", 9)

    admission_no = admission.admission_number or "PENDING"

    # FIX: application_date is a DateTimeField (auto_now_add=True) — use strftime directly
    date_str = admission.application_date.strftime("%d %B %Y") if admission.application_date else ""

    school_block = [
        para("LEADING STARS ACADEMY",  13, bold=True, color=WHITE,  align=TA_CENTER),
        para("WHERE LEADERS ARE BORN",  7,             color=MBLUE,  align=TA_CENTER),
        Spacer(1, 1 * mm),
        para("ADMISSION FORM",         11, bold=True, color=GOLD,   align=TA_CENTER),
        para(f"Ref: {admission_no}",    8,             color=colors.HexColor("#e0e7ff"), align=TA_CENTER),
    ]

    date_block = [
        para("Date Applied", 7, color=MBLUE,  align=TA_RIGHT),
        para(date_str,        8, color=WHITE,  align=TA_RIGHT),
    ]

    tbl = Table([[logo_cell, school_block, date_block]], colWidths=[22 * mm, 128 * mm, 36 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (0,  0),  6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    return tbl


def build_status_badge(admission):
    status_map = {
        "approved": ("✓  APPROVED", GREEN,  LGREEN),
        "rejected": ("✗  REJECTED", colors.HexColor("#dc2626"), colors.HexColor("#fee2e2")),
        "pending":  ("●  PENDING",  GOLD,   colors.HexColor("#fff7ed")),
    }
    text, fg, bg = status_map.get(admission.status, ("●  PENDING", GOLD, colors.HexColor("#fff7ed")))
    badge = Table([[para(text, 9, bold=True, color=fg, align=TA_CENTER)]], colWidths=[PW])
    badge.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg),
        ("BOX",           (0, 0), (-1, -1), 1, fg),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return badge


def build_photo_card(admission):
    photo = load_admission_photo(admission)
    photo_cell = photo if photo else para("No\nPhoto", 7, color=LGRAY, align=TA_CENTER)
    wrapper = Table([[photo_cell]], colWidths=[30 * mm])
    wrapper.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1.5, BLUE),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND",    (0, 0), (-1, -1), LBLUE),
    ]))
    return wrapper


def build_section_header(title):
    tbl = Table([[para(title, 9, bold=True, color=WHITE)]], colWidths=[PW])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]))
    return tbl


def build_student_section(admission):
    # FIX: guard applied_class FK — could be None
    class_name = admission.applied_class.name if admission.applied_class else "—"

    # FIX: date_of_birth is a DateField (nullable) — guard before strftime
    dob = admission.date_of_birth.strftime("%d %B %Y") if admission.date_of_birth else "—"

    left_rows = [
        ["Full Name",     f"{admission.first_name} {admission.last_name}".strip() or "—"],
        ["Gender",        admission.gender or "—"],
        ["Date of Birth", dob],
        ["Nationality",   admission.nationality or "—"],
    ]
    right_rows = [
        ["Religion",        admission.religion or "—"],
        ["Applied Class",   class_name],
        ["Previous School", admission.previous_school or "—"],
        ["Health Notes",    admission.health_notes or "None"],
    ]

    def make_info_table(data, col_widths):
        rows = [
            [para(r[0], 8, bold=True, color=BLUE), para(r[1], 8, color=BLACK)]
            for r in data
        ]
        t = Table(rows, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.3, SILVER),
        ]))
        return t

    left_tbl   = make_info_table(left_rows,  [40 * mm, 52 * mm])
    right_tbl  = make_info_table(right_rows, [40 * mm, 52 * mm])
    photo_card = build_photo_card(admission)

    combined = Table(
        [[left_tbl, right_tbl, photo_card]],
        colWidths=[92 * mm, 92 * mm, 34 * mm],
    )
    combined.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("BOX",           (0, 0), (-1, -1), 0.8, SILVER),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
    ]))
    return combined


def build_parent_section(admission):
    """
    FIX: The documentation listed parent_phone / parent_email but the actual
    Admission model fields are phone and email (shared contact fields).
    parent_gender and relationship are also included from the real model.
    """
    rows = [
        ["Parent / Guardian Name", admission.parent_name    or "—"],
        ["Relationship",           admission.relationship   or "—"],
        ["Gender",                 admission.parent_gender  or "—"],
        ["Phone",                  admission.phone          or "—"],
        ["Alt. Phone",             admission.alt_phone      or "—"],
        ["Email",                  admission.email          or "—"],
        ["Home Address",           admission.address        or "—"],
    ]

    tbl_rows = [
        [para(r[0], 8, bold=True, color=BLUE), para(r[1], 8, color=BLACK)]
        for r in rows
    ]
    tbl = Table(tbl_rows, colWidths=[52 * mm, PW - 52 * mm])
    tbl.setStyle(TableStyle([
        ("TOPPADDING",     (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 5),
        ("LEFTPADDING",    (0, 0), (-1, -1), 8),
        ("LINEBELOW",      (0, 0), (-1, -2), 0.3, SILVER),
        ("BOX",            (0, 0), (-1, -1), 0.8, SILVER),
        ("BACKGROUND",     (0, 0), (-1, -1), GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY]),
    ]))
    return tbl


def build_footer_note():
    note = Table(
        [[para(
            "This document is an official admission record of Leading Stars Academy.  "
            "Please retain a copy for your records.",
            7, color=LGRAY, align=TA_CENTER,
        )]],
        colWidths=[PW],
    )
    note.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return note


# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — Acceptance Form
# ─────────────────────────────────────────────────────────────────────────────

def build_acceptance_header():
    logo_cell = load_logo() or para("", 9)
    school_block = [
        para("LEADING STARS ACADEMY",  13, bold=True, color=WHITE, align=TA_CENTER),
        para("WHERE LEADERS ARE BORN",  7,             color=MBLUE, align=TA_CENTER),
        Spacer(1, 1 * mm),
        para("ACCEPTANCE FORM",        11, bold=True, color=GOLD,  align=TA_CENTER),
        para("To be signed and returned to the school office", 8,
             color=colors.HexColor("#e0e7ff"), align=TA_CENTER),
    ]
    tbl = Table([[logo_cell, school_block, para("", 9)]], colWidths=[22 * mm, 142 * mm, 22 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (0,  0),  6),
    ]))
    return tbl


def build_intro_text(admission):
    # FIX: guard applied_class FK
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
        fontSize=9, fontName="Helvetica",
        textColor=BLACK, leading=14, spaceAfter=0,
    )
    box = Table([[Paragraph(intro, style)]], colWidths=[PW])
    box.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.8, BLUE),
        ("BACKGROUND",    (0, 0), (-1, -1), LBLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
    ]))
    return box


def build_signature_section():
    elements = []

    # ── Parent / Guardian declaration ────────────────────────────────────────
    elements.append(build_section_header("PARENT / GUARDIAN DECLARATION"))
    elements.append(Spacer(1, 4 * mm))

    name_line = Table(
        [[para("", 8), para("", 8)]],
        colWidths=[PW / 2 - 4 * mm, PW / 2 - 4 * mm],
    )
    name_line.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, -1), 1,   BLACK),
        ("TOPPADDING",    (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    name_labels = Table(
        [[para("Full Name of Parent / Guardian", 7, color=LGRAY),
          para("Relationship to Student",         7, color=LGRAY)]],
        colWidths=[PW / 2 - 4 * mm, PW / 2 - 4 * mm],
    )

    phone_line = Table(
        [[para("", 8), para("", 8)]],
        colWidths=[PW / 2 - 4 * mm, PW / 2 - 4 * mm],
    )
    phone_line.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, -1), 1,   BLACK),
        ("TOPPADDING",    (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    phone_labels = Table(
        [[para("Phone Number",  7, color=LGRAY),
          para("Email Address", 7, color=LGRAY)]],
        colWidths=[PW / 2 - 4 * mm, PW / 2 - 4 * mm],
    )

    sig_date = Table(
        [[para("", 8), para("", 8)]],
        colWidths=[PW * 0.6, PW * 0.4 - 4 * mm],
    )
    sig_date.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, -1), 1.5, BLACK),
        ("TOPPADDING",    (0, 0), (-1, -1), 24),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    sig_date_labels = Table(
        [[para("Signature of Parent / Guardian", 7, color=LGRAY),
          para("Date",                           7, color=LGRAY)]],
        colWidths=[PW * 0.6, PW * 0.4 - 4 * mm],
    )

    elements += [
        name_line, name_labels, Spacer(1, 4 * mm),
        phone_line, phone_labels, Spacer(1, 4 * mm),
        sig_date, sig_date_labels,
    ]

    elements.append(Spacer(1, 10 * mm))
    elements.append(divider())
    elements.append(Spacer(1, 6 * mm))

    # ── School declaration ────────────────────────────────────────────────────
    elements.append(build_section_header("FOR OFFICIAL USE — SCHOOL DECLARATION"))
    elements.append(Spacer(1, 4 * mm))

    declaration = (
        "This is to certify that the above-named student has been duly admitted to "
        "Leading Stars Academy and is entitled to all the rights and privileges of a "
        "student of this institution, subject to compliance with all school regulations."
    )
    style = ParagraphStyle(
        "decl",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=9, fontName="Helvetica",
        textColor=BLACK, leading=14,
    )
    decl_box = Table([[Paragraph(declaration, style)]], colWidths=[PW])
    decl_box.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.8, SILVER),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
    ]))
    elements.append(decl_box)
    elements.append(Spacer(1, 6 * mm))

    principal_row = Table(
        [[para("", 8), para("", 8), para("", 8)]],
        colWidths=[PW * 0.38, PW * 0.3, PW * 0.3 - 4 * mm],
    )
    principal_row.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, -1), 1.5, BLACK),
        ("TOPPADDING",    (0, 0), (-1, -1), 30),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    principal_labels = Table(
        [[para("Signature of Principal / Head Teacher", 7, color=LGRAY),
          para("Official School Stamp",                 7, color=LGRAY),
          para("Date",                                  7, color=LGRAY)]],
        colWidths=[PW * 0.38, PW * 0.3, PW * 0.3 - 4 * mm],
    )

    elements += [principal_row, principal_labels]
    elements.append(Spacer(1, 10 * mm))

    # Stamp box
    stamp = Table(
        [[para("OFFICIAL STAMP", 8, color=SILVER, align=TA_CENTER)]],
        colWidths=[50 * mm],
        rowHeights=[35 * mm],
    )
    stamp.setStyle(TableStyle([
        ("BOX",    (0, 0), (-1, -1), 1,   SILVER),
        ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    stamp_row = Table([[para("", 8), stamp]], colWidths=[PW - 54 * mm, 54 * mm])
    stamp_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))
    elements.append(stamp_row)

    return elements


def build_acceptance_footer():
    lines = [
        "• This form must be signed by a parent or guardian and returned to the school office within 14 days of the offer.",
        "• Failure to return this form may result in the admission offer being withdrawn.",
        "• Please retain the yellow copy for your records.",
    ]
    rows = [[para(l, 7, color=DGRAY)] for l in lines]
    tbl  = Table(rows, colWidths=[PW])
    tbl.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, SILVER),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]))
    return tbl


# ─────────────────────────────────────────────────────────────────────────────
# View
# ─────────────────────────────────────────────────────────────────────────────

class AdmissionFormPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, admission_id):
        # FIX: select_related applied_class so FK access doesn't hit DB twice
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
        pdf    = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
        )

        elements = []

        # ── PAGE 1: Admission details ────────────────────────────────────────
        elements.append(build_page1_header(admission))
        elements.append(Spacer(1, 4 * mm))
        elements.append(build_status_badge(admission))
        elements.append(Spacer(1, 5 * mm))

        elements.append(build_section_header("STUDENT INFORMATION"))
        elements.append(Spacer(1, 1 * mm))
        elements.append(build_student_section(admission))
        elements.append(Spacer(1, 5 * mm))

        elements.append(build_section_header("PARENT / GUARDIAN INFORMATION"))
        elements.append(Spacer(1, 1 * mm))
        elements.append(build_parent_section(admission))
        elements.append(Spacer(1, 8 * mm))

        elements.append(divider())
        elements.append(Spacer(1, 2 * mm))
        elements.append(build_footer_note())

        # ── PAGE 2: Acceptance form ──────────────────────────────────────────
        elements.append(PageBreak())

        elements.append(build_acceptance_header())
        elements.append(Spacer(1, 6 * mm))
        elements.append(build_intro_text(admission))
        elements.append(Spacer(1, 8 * mm))

        elements += build_signature_section()

        elements.append(Spacer(1, 6 * mm))
        elements.append(divider())
        elements.append(Spacer(1, 3 * mm))
        elements.append(build_acceptance_footer())

        pdf.build(elements)
        buffer.seek(0)

        name_slug = (
            f"{admission.first_name}_{admission.last_name}".strip("_").replace(" ", "_")
        )
        filename = f"admission_form_{name_slug}.pdf"

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response