from io import BytesIO
import os
from PIL import Image as PilImage, ImageOps
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone

from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, Image,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

import requests

from apps.fees.models import Fee
from apps.students.models import Student

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------

BLUE   = colors.HexColor("#1e40af")
LBLUE  = colors.HexColor("#dbeafe")
MBLUE  = colors.HexColor("#bfdbfe")
GRAY   = colors.HexColor("#f9fafb")
MGRAY  = colors.HexColor("#f3f4f6")
DGRAY  = colors.HexColor("#374151")
LGRAY  = colors.HexColor("#9ca3af")
WHITE  = colors.white
GOLD   = colors.HexColor("#d97706")
RED    = colors.HexColor("#dc2626")
LRED   = colors.HexColor("#fee2e2")
GREEN  = colors.HexColor("#16a34a")
LGREEN = colors.HexColor("#dcfce7")
BLACK  = colors.HexColor("#111827")

TERM_LABELS = {"term1": "Term 1", "term2": "Term 2", "term3": "Term 3"}
LOGO_PATH   = os.path.join(settings.BASE_DIR, "static", "images", "logo.jpeg")

W = A4[0] - 40*mm  # usable width for single-student view


# ---------------------------------------------------------------------------
# Helpers  (identical pattern to the working report PDF view)
# ---------------------------------------------------------------------------


def load_image_flowable(path_or_url, width, height):
    try:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            resp = requests.get(path_or_url, timeout=5)
            resp.raise_for_status()
            img_bytes = BytesIO(resp.content)
        elif os.path.exists(path_or_url):
            with open(path_or_url, "rb") as f:
                img_bytes = BytesIO(f.read())
        else:
            return None

        # Fix EXIF orientation (phones save images rotated)
        pil_img = PilImage.open(img_bytes)
        pil_img = ImageOps.exif_transpose(pil_img)

        # Convert to RGB so ReportLab can embed it as JPEG
        if pil_img.mode in ("RGBA", "P", "CMYK", "LA"):
            pil_img = pil_img.convert("RGB")

        corrected = BytesIO()
        pil_img.save(corrected, format="JPEG")
        corrected.seek(0)

        return Image(corrected, width=width, height=height)

    except Exception:
        pass
    return None


def load_student_photo(student, width=24*mm, height=26*mm):
    """Resolve photo URL/path and load — mirrors report_pdf_view exactly."""
    try:
        if not student.photo:
            return None
        photo_url = student.photo.url
        if not photo_url.startswith("http"):
            photo_path = os.path.join(settings.MEDIA_ROOT, str(student.photo))
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


# ---------------------------------------------------------------------------
# Shared header
# ---------------------------------------------------------------------------

def build_header(term, year):
    logo_cell = load_logo() or para("", 9)
    year_str  = str(year) if year else str(timezone.now().year)

    school_block = [
        para("LEADING STARS ACADEMY",  13, bold=True,  color=WHITE, align=TA_CENTER),
        para("WHERE LEADERS ARE BORN",  7, bold=False, color=colors.HexColor("#bfdbfe"), align=TA_CENTER),
        Spacer(1, 1*mm),
        para("FEE STATEMENT",          11, bold=True,  color=GOLD,  align=TA_CENTER),
        para(f"{TERM_LABELS.get(term, term)}  ·  {year_str}", 8,
             color=colors.HexColor("#e0e7ff"), align=TA_CENTER),
    ]

    tbl = Table([[logo_cell, school_block, para("", 9)]], colWidths=[22*mm, 142*mm, 22*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (0,  0),  6),
    ]))
    return tbl


# ---------------------------------------------------------------------------
# Student info card  (photo loaded same way as report PDF)
# ---------------------------------------------------------------------------

def build_student_card(student, term, year):
    class_name = student.school_class.name if student.school_class else "—"
    year_str   = str(year) if year else str(timezone.now().year)

    photo      = load_student_photo(student)
    photo_cell = photo if photo else para("No\nPhoto", 7, color=LGRAY, align=TA_CENTER)

    def info_row(label, value):
        return [
            para(label, 8, bold=True, color=BLUE),
            para(value,  8, color=BLACK),
        ]

    info = Table([
        info_row("Student",      student.full_name),
        info_row("Admission No", student.admission_number),
        info_row("Class",        class_name),
        info_row("Term",         TERM_LABELS.get(term, term)),
        info_row("Year",         year_str),
    ], colWidths=[32*mm, 100*mm])
    info.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, colors.HexColor("#e5e7eb")),
    ]))

    photo_wrapper = Table([[photo_cell]], colWidths=[30*mm])
    photo_wrapper.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1.5, BLUE),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND",    (0, 0), (-1, -1), LBLUE),
    ]))

    card = Table([[info, photo_wrapper]], colWidths=[136*mm, 32*mm])
    card.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.8, colors.HexColor("#d1d5db")),
        ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return card


# ---------------------------------------------------------------------------
# Fee breakdown table
# ---------------------------------------------------------------------------

def build_fee_table(fee):
    def row(label, value, highlight=False, value_color=None):
        vc = value_color or (BLUE if highlight else BLACK)
        return [
            para(label, 9, bold=highlight, color=BLUE if highlight else BLACK),
            para(f"GHS {float(value):,.2f}", 9, bold=highlight, color=vc, align=TA_RIGHT),
        ]

    rows        = []
    divider_idx = 0

    rows.append(row("School Fees", fee.amount))
    if fee.book_user_fee and float(fee.book_user_fee) > 0:
        rows.append(row("Book User Fee", fee.book_user_fee))
    if fee.workbook_fee and float(fee.workbook_fee) > 0:
        rows.append(row("Workbook Fee", fee.workbook_fee))
    if fee.arrears and float(fee.arrears) > 0:
        rows.append(row("Arrears", fee.arrears, value_color=RED))

    divider_idx = len(rows)
    rows.append([para("", 3), para("", 3)])   # spacer row

    rows.append(row("TOTAL DUE",   fee.total_amount, highlight=True))
    rows.append(row("Amount Paid", fee.paid, value_color=GREEN))

    balance   = float(fee.balance)
    bal_color = GREEN if balance <= 0 else RED
    rows.append([
        para("BALANCE", 9, bold=True, color=BLACK),
        para(f"GHS {balance:,.2f}", 9, bold=True, color=bal_color, align=TA_RIGHT),
    ])

    tbl   = Table(rows, colWidths=[120*mm, 48*mm])
    style = [
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, divider_idx - 1), 0.3, colors.HexColor("#e5e7eb")),
        ("BOX",           (0, 0), (-1, -1), 0.8, colors.HexColor("#d1d5db")),
        ("BACKGROUND",    (0, divider_idx + 1), (-1, -1), LBLUE),
        ("LINEABOVE",     (0, divider_idx + 1), (-1, divider_idx + 1), 1, BLUE),
        ("BACKGROUND",    (0, -1), (-1, -1), LGREEN if balance <= 0 else LRED),
    ]
    for i in range(divider_idx):
        if i % 2 == 1:
            style.append(("BACKGROUND", (0, i), (-1, i), MGRAY))
    tbl.setStyle(TableStyle(style))
    return tbl


# ---------------------------------------------------------------------------
# Single-student view
# ---------------------------------------------------------------------------

class StudentFeeBillPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        term = request.query_params.get("term")
        if not term:
            from rest_framework.response import Response
            return Response({"error": "term is required"}, status=400)

        student = get_object_or_404(Student, id=student_id)
        fee     = Fee.objects.filter(student=student, term=term).first()
        if not fee:
            from rest_framework.response import Response
            return Response({"error": "No fee record found for this student and term."}, status=404)

        year = getattr(fee, "year", None) or timezone.now().year

        buffer = BytesIO()
        pdf    = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=20*mm, rightMargin=20*mm,
            topMargin=15*mm, bottomMargin=15*mm,
        )
        elements = []

        elements.append(build_header(term, year))
        elements.append(Spacer(1, 5*mm))
        elements.append(build_student_card(student, term, year))
        elements.append(Spacer(1, 5*mm))
        elements.append(para("Fee Breakdown", 10, bold=True, color=BLUE))
        elements.append(Spacer(1, 2*mm))
        elements.append(build_fee_table(fee))
        elements.append(Spacer(1, 7*mm))

        # Status badge
        paid       = float(fee.balance) <= 0
        badge_text = "✓  FULLY PAID" if paid else "⚠  PAYMENT PENDING"
        badge_bg   = LGREEN if paid else LRED
        badge_col  = GREEN  if paid else RED

        badge = Table(
            [[para(badge_text, 12, bold=True, color=badge_col, align=TA_CENTER)]],
            colWidths=[W],
        )
        badge.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), badge_bg),
            ("BOX",           (0, 0), (-1, -1), 1.2, badge_col),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        elements.append(badge)
        elements.append(Spacer(1, 7*mm))

        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
        elements.append(Spacer(1, 2*mm))
        elements.append(para(
            "Please ensure all fees are settled before the end of term.  "
            "Thank you for choosing Leading Stars Academy.",
            8, color=LGRAY, align=TA_CENTER,
        ))

        pdf.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="bill_{student.admission_number}_{term}.pdf"'
        )
        return response


# ---------------------------------------------------------------------------
# Class-wide view
# ---------------------------------------------------------------------------

class ClassFeeBillPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        term         = request.query_params.get("term")
        school_class = request.query_params.get("school_class")

        if not term or not school_class:
            from rest_framework.response import Response
            return Response({"error": "term and school_class are required"}, status=400)

        fees = (
            Fee.objects
            .filter(student__school_class_id=school_class, term=term)
            .select_related("student", "student__school_class")
            .order_by("student__admission_number")
        )
        if not fees.exists():
            from rest_framework.response import Response
            return Response({"error": "No fee records found."}, status=404)

        year       = getattr(fees.first(), "year", None) or timezone.now().year
        class_name = fees.first().student.school_class.name if fees.first().student.school_class else "—"

        buffer = BytesIO()
        pdf    = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=12*mm, rightMargin=12*mm,
            topMargin=12*mm, bottomMargin=12*mm,
        )
        elements = []

        elements.append(build_header(term, year))
        elements.append(Spacer(1, 4*mm))

        sub = Table([[
            para(f"Class: {class_name}", 10, bold=True, color=BLUE),
            para(f"Academic Year: {year}", 10, bold=True, color=DGRAY, align=TA_RIGHT),
        ]], colWidths=[90*mm, 84*mm])
        sub.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 2),
        ]))
        elements.append(sub)
        elements.append(Spacer(1, 3*mm))

        CW = [44*mm, 20*mm, 20*mm, 20*mm, 16*mm, 22*mm, 20*mm, 16*mm]

        def hdr(text):
            return para(text, 8, bold=True, color=WHITE, align=TA_CENTER)

        header_row = [
            para("Student", 8, bold=True, color=WHITE),
            hdr("Fees"), hdr("Books"), hdr("Workbook"),
            hdr("Arrears"), hdr("Total"), hdr("Paid"), hdr("Balance"),
        ]

        rows = [header_row]
        total_expected = total_paid = total_balance = 0

        for fee in fees:
            bal       = float(fee.balance)
            bal_color = GREEN if bal <= 0 else RED
            rows.append([
                para(fee.student.full_name,               8),
                para(f"{float(fee.amount):,.0f}",         8, align=TA_CENTER),
                para(f"{float(fee.book_user_fee):,.0f}",  8, align=TA_CENTER),
                para(f"{float(fee.workbook_fee):,.0f}",   8, align=TA_CENTER),
                para(f"{float(fee.arrears):,.0f}",        8, align=TA_CENTER),
                para(f"{float(fee.total_amount):,.0f}",   8, bold=True, color=BLUE,      align=TA_CENTER),
                para(f"{float(fee.paid):,.0f}",           8, color=GREEN,                align=TA_CENTER),
                para(f"{bal:,.0f}",                       8, bold=True, color=bal_color, align=TA_CENTER),
            ])
            total_expected += float(fee.total_amount)
            total_paid     += float(fee.paid)
            total_balance  += float(fee.balance)

        rows.append([
            para("TOTALS", 8, bold=True, color=WHITE),
            para("", 8), para("", 8), para("", 8), para("", 8),
            para(f"{total_expected:,.0f}", 8, bold=True, color=WHITE, align=TA_CENTER),
            para(f"{total_paid:,.0f}",     8, bold=True, color=WHITE, align=TA_CENTER),
            para(f"{total_balance:,.0f}",  8, bold=True, color=WHITE, align=TA_CENTER),
        ])

        tbl = Table(rows, colWidths=CW)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0),  (-1, 0),  BLUE),
            ("TOPPADDING",     (0, 0),  (-1, 0),  6),
            ("BOTTOMPADDING",  (0, 0),  (-1, 0),  6),
            ("BACKGROUND",     (0, -1), (-1, -1), DGRAY),
            ("LINEABOVE",      (0, -1), (-1, -1), 1.2, BLUE),
            ("ROWBACKGROUNDS", (0, 1),  (-1, -2), [WHITE, MGRAY]),
            ("GRID",           (0, 0),  (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ("BOX",            (0, 0),  (-1, -1), 0.8, colors.HexColor("#d1d5db")),
            ("TOPPADDING",     (0, 1),  (-1, -1), 4),
            ("BOTTOMPADDING",  (0, 1),  (-1, -1), 4),
            ("LEFTPADDING",    (0, 0),  (-1, -1), 4),
            ("VALIGN",         (0, 0),  (-1, -1), "MIDDLE"),
        ]))
        elements.append(tbl)
        elements.append(Spacer(1, 6*mm))

        # Summary strip
        summary = Table([[
            para(f"Students: {len(fees)}", 9, bold=True, color=DGRAY, align=TA_CENTER),
            para(f"Expected: GHS {total_expected:,.2f}", 9, bold=True, color=BLUE, align=TA_CENTER),
            para(f"Collected: GHS {total_paid:,.2f}",   9, bold=True, color=GREEN, align=TA_CENTER),
            para(f"Outstanding: GHS {total_balance:,.2f}", 9, bold=True,
                 color=RED if total_balance > 0 else GREEN, align=TA_CENTER),
        ]], colWidths=[43*mm, 50*mm, 50*mm, 50*mm])
        summary.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), LBLUE),
            ("BOX",           (0, 0), (-1, -1), 0.8, BLUE),
            ("GRID",          (0, 0), (-1, -1), 0.3, MBLUE),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary)
        elements.append(Spacer(1, 5*mm))

        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
        elements.append(Spacer(1, 2*mm))
        elements.append(para(
            "Please ensure all fees are settled before the end of term.  "
            "Thank you for choosing Leading Stars Academy.",
            8, color=LGRAY, align=TA_CENTER,
        ))

        pdf.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="class_bill_{class_name}_{term}.pdf"'
        )
        return response
