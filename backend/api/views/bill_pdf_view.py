from io import BytesIO
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings

from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.fees.models import Fee
from apps.students.models import Student

import os

TERM_LABELS = {"term1": "Term 1", "term2": "Term 2", "term3": "Term 3"}

BLUE  = colors.HexColor("#1d4ed8")
LBLUE = colors.HexColor("#dbeafe")
GRAY  = colors.HexColor("#f3f4f6")
DGRAY = colors.HexColor("#374151")
WHITE = colors.white
GOLD  = colors.HexColor("#fbbf24")
RED   = colors.HexColor("#dc2626")
GREEN = colors.HexColor("#16a34a")

LOGO_PATH = os.path.join(settings.BASE_DIR, "static", "images", "logo.jpeg")


def load_logo():
    try:
        if os.path.exists(LOGO_PATH):
            return Image(LOGO_PATH, width=20*mm, height=20*mm)
    except Exception:
        pass
    return None


def para(text, size=9, bold=False, color=DGRAY, align=TA_LEFT, styles=None):
    return Paragraph(text, ParagraphStyle(
        "p",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=size,
        fontName="Helvetica-Bold" if bold else "Helvetica",
        textColor=color,
        alignment=align,
        leading=size + 3,
    ))


def build_bill_header(term):
    """Shared header for both single and class bills."""
    logo      = load_logo()
    logo_cell = logo if logo else para("", 9)

    center = [
        para("LEADING STARS ACADEMY",  14, bold=True,  color=BLUE, align=TA_CENTER),
        para("WHERE LEADERS ARE BORN",  8, bold=False, color=colors.HexColor("#92400e"), align=TA_CENTER),
        para("FEE BILL",               12, bold=True,  color=GOLD, align=TA_CENTER),
        para(TERM_LABELS.get(term, term), 9, color=DGRAY, align=TA_CENTER),
    ]

    header_table = Table([[logo_cell, center, para("", 9)]], colWidths=[22*mm, 142*mm, 22*mm])
    header_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
        ("BOX",           (0, 0), (-1, -1), 0.8, BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (0,  0),  4),
    ]))
    return header_table


def build_student_fee_rows(fee):
    """Build the fee breakdown rows for one student."""
    rows = []

    def fee_row(label, value, highlight=False):
        return [
            para(label, 9, bold=highlight),
            para(f"GHS {float(value):,.2f}", 9, bold=highlight,
                 color=BLUE if highlight else DGRAY, align=TA_RIGHT),
        ]

    rows.append(fee_row("School Fees",    fee.amount))
    if fee.book_user_fee and float(fee.book_user_fee) > 0:
        rows.append(fee_row("Book User Fee", fee.book_user_fee))
    if fee.workbook_fee and float(fee.workbook_fee) > 0:
        rows.append(fee_row("Workbook Fee",  fee.workbook_fee))
    if fee.arrears and float(fee.arrears) > 0:
        rows.append(fee_row("Arrears",       fee.arrears))

    # Divider row
    rows.append([
        para("", 4), para("", 4),
    ])

    rows.append(fee_row("TOTAL DUE", fee.total_amount, highlight=True))
    rows.append(fee_row("Amount Paid", fee.paid))

    balance_color = GREEN if float(fee.balance) <= 0 else RED
    rows.append([
        para("BALANCE", 9, bold=True),
        para(f"GHS {float(fee.balance):,.2f}", 9, bold=True, color=balance_color, align=TA_RIGHT),
    ])

    return rows


class StudentFeeBillPDFView(APIView):
    """Generate a fee bill PDF for a single student."""

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

        buffer = BytesIO()
        pdf    = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=20*mm, rightMargin=20*mm,
            topMargin=15*mm, bottomMargin=15*mm,
        )
        elements = []

        # Header
        elements.append(build_bill_header(term))
        elements.append(Spacer(1, 6*mm))

        # Student info
        class_name = student.school_class.name if student.school_class else "-"
        info_rows  = [
            [para("<b>Student:</b>",        9), para(student.full_name,          9)],
            [para("<b>Admission No:</b>",   9), para(student.admission_number,   9)],
            [para("<b>Class:</b>",          9), para(class_name,                 9)],
            [para("<b>Term:</b>",           9), para(TERM_LABELS.get(term, term),9)],
        ]
        info_table = Table(info_rows, colWidths=[40*mm, 120*mm])
        info_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("BOX",  (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 6*mm))

        # Fee breakdown
        elements.append(para("Fee Breakdown", 10, bold=True, color=BLUE))
        elements.append(Spacer(1, 2*mm))

        fee_rows  = build_student_fee_rows(fee)
        fee_table = Table(fee_rows, colWidths=[120*mm, 40*mm])
        fee_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("BOX",  (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("LINEBELOW", (0, -3), (-1, -3), 0.5, colors.HexColor("#d1d5db")),
            ("BACKGROUND", (0, -3), (-1, -1), colors.HexColor("#eff6ff")),
        ]))
        elements.append(fee_table)
        elements.append(Spacer(1, 8*mm))

        # Status stamp
        status_text  = "FULLY PAID" if float(fee.balance) <= 0 else "PAYMENT PENDING"
        status_color = GREEN if float(fee.balance) <= 0 else RED
        elements.append(para(status_text, 14, bold=True, color=status_color, align=TA_CENTER))
        elements.append(Spacer(1, 6*mm))

        # Footer
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d1d5db")))
        elements.append(Spacer(1, 2*mm))
        elements.append(para(
            "Please ensure all fees are paid before the end of term. Thank you.",
            8, color=colors.HexColor("#9ca3af"), align=TA_CENTER,
        ))

        pdf.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="bill_{student.admission_number}_{term}.pdf"'
        )
        return response


class ClassFeeBillPDFView(APIView):
    """Generate a fee bill PDF for all students in a class."""

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

        buffer = BytesIO()
        pdf    = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=12*mm, rightMargin=12*mm,
            topMargin=12*mm, bottomMargin=12*mm,
        )
        elements = []

        # Header
        elements.append(build_bill_header(term))
        elements.append(Spacer(1, 4*mm))

        class_name = fees.first().student.school_class.name if fees.first().student.school_class else "-"
        elements.append(para(f"Class: {class_name}", 10, bold=True, color=DGRAY))
        elements.append(Spacer(1, 3*mm))

        # Table header
        col_widths = [42*mm, 22*mm, 22*mm, 22*mm, 18*mm, 22*mm, 22*mm, 16*mm]
        header_row = [
            para("Student",       8, bold=True, color=BLUE),
            para("Fees",          8, bold=True, color=BLUE, align=TA_CENTER),
            para("Books",         8, bold=True, color=BLUE, align=TA_CENTER),
            para("Workbook",      8, bold=True, color=BLUE, align=TA_CENTER),
            para("Arrears",       8, bold=True, color=BLUE, align=TA_CENTER),
            para("Total",         8, bold=True, color=BLUE, align=TA_CENTER),
            para("Paid",          8, bold=True, color=BLUE, align=TA_CENTER),
            para("Balance",       8, bold=True, color=BLUE, align=TA_CENTER),
        ]

        rows = [header_row]
        total_expected = total_paid = total_balance = 0

        for i, fee in enumerate(fees):
            balance_color = GREEN if float(fee.balance) <= 0 else RED
            rows.append([
                para(fee.student.full_name,                   8),
                para(f"{float(fee.amount):,.0f}",             8, align=TA_CENTER),
                para(f"{float(fee.book_user_fee):,.0f}",      8, align=TA_CENTER),
                para(f"{float(fee.workbook_fee):,.0f}",       8, align=TA_CENTER),
                para(f"{float(fee.arrears):,.0f}",            8, align=TA_CENTER),
                para(f"<b>{float(fee.total_amount):,.0f}</b>",8, color=BLUE, align=TA_CENTER),
                para(f"{float(fee.paid):,.0f}",               8, color=GREEN, align=TA_CENTER),
                para(f"<b>{float(fee.balance):,.0f}</b>",     8, color=balance_color, align=TA_CENTER),
            ])
            total_expected += float(fee.total_amount)
            total_paid     += float(fee.paid)
            total_balance  += float(fee.balance)

        # Totals row
        rows.append([
            para("TOTALS", 8, bold=True),
            para("", 8), para("", 8), para("", 8), para("", 8),
            para(f"<b>{total_expected:,.0f}</b>", 8, bold=True, color=BLUE,  align=TA_CENTER),
            para(f"<b>{total_paid:,.0f}</b>",     8, bold=True, color=GREEN, align=TA_CENTER),
            para(f"<b>{total_balance:,.0f}</b>",  8, bold=True, color=RED,   align=TA_CENTER),
        ])

        table = Table(rows, colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0),  (-1, 0),  LBLUE),
            ("BACKGROUND",     (0, -1), (-1, -1), GRAY),
            ("ROWBACKGROUNDS", (0, 1),  (-1, -2), [WHITE, GRAY]),
            ("GRID",           (0, 0),  (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ("BOX",            (0, 0),  (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("TOPPADDING",     (0, 0),  (-1, -1), 4),
            ("BOTTOMPADDING",  (0, 0),  (-1, -1), 4),
            ("LEFTPADDING",    (0, 0),  (-1, -1), 4),
            ("VALIGN",         (0, 0),  (-1, -1), "MIDDLE"),
            ("LINEABOVE",      (0, -1), (-1, -1), 0.8, BLUE),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 6*mm))

        # Footer
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d1d5db")))
        elements.append(Spacer(1, 2*mm))
        elements.append(para(
            "Please ensure all fees are paid before the end of term. Thank you.",
            8, color=colors.HexColor("#9ca3af"), align=TA_CENTER,
        ))

        pdf.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="class_bill_{class_name}_{term}.pdf"'
        )
        return response