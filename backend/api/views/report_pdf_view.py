from io import BytesIO
from django.http import HttpResponse
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable, Image
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404
from django.conf import settings

import requests
import os

from apps.students.models import Student
from apps.results.models import Result, Report
from apps.attendance.models import Attendance


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TERM_LABELS = {"term1": "Term 1", "term2": "Term 2", "term3": "Term 3"}

BLUE  = colors.HexColor("#1d4ed8")
LBLUE = colors.HexColor("#dbeafe")
GRAY  = colors.HexColor("#f3f4f6")
DGRAY = colors.HexColor("#374151")
WHITE = colors.white
GOLD  = colors.HexColor("#fbbf24")

LOGO_PATH = os.path.join(settings.BASE_DIR, "static", "images", "logo.jpeg")

SCHOOL_NAMES = {
    "nursery_kg": "LEADING STARS MONTESSORI",
    "basic_1_6":  "LEADING STARS ACADEMY",
    "basic_7_9":  "LEADING STARS ACADEMY",
}

SCHOOL_MOTTOS = {
    "nursery_kg": "GLOBAL LEADERS",
    "basic_1_6":  "WHERE LEADERS ARE BORN",
    "basic_7_9":  "WHERE LEADERS ARE BORN",
}

# ---------------------------------------------------------------------------
# Grading systems
# ---------------------------------------------------------------------------

GRADE_THRESHOLDS_B79 = [
    (90, "1", "HIGHEST"),
    (80, "2", "HIGHER"),
    (60, "3", "HIGH"),
    (55, "4", "HIGH AVERAGE"),
    (50, "5", "AVERAGE"),
    (45, "6", "LOW AVERAGE"),
    (40, "7", "LOW"),
    (35, "8", "LOWER"),
    (0,  "9", "LOWEST"),
]

GRADE_THRESHOLDS_B16 = [
    (90, "A",  "EXCELLENT"),
    (80, "B",  "VERY GOOD"),
    (60, "C",  "GOOD"),
    (55, "D",  "HIGH AVERAGE"),
    (45, "E2", "BELOW AVERAGE"),
    (40, "E3", "LOW"),
    (35, "E4", "LOWER"),
    (0,  "E5", "LOWEST"),
]

INTERP_ROWS_B79 = [
    ("90-100: 1 – HIGHEST",    "55-59: 4 – HIGH AVERAGE", "40-44: 7 – LOW"   ),
    ("80-89: 2 – HIGHER",      "50-54: 5 – AVERAGE",      "35-39: 8 – LOWER" ),
    ("60-79: 3 – HIGH",        "45-49: 6 – LOW AVERAGE",  "0-34: 9 – LOWEST" ),
]

INTERP_ROWS_B16 = [
    ("90-100: A – EXCELLENT",  "55-59: D – HIGH AVERAGE", "40-44: E3 – LOW"   ),
    ("80-89: B – VERY GOOD",   "50-54: E – AVERAGE",      "35-39: E4 – LOWER" ),
    ("60-79: C – GOOD",        "45-49: E2 – BELOW AVG",   "0-34: E5 – LOWEST" ),
]


def get_thresholds(level: str) -> list:
    if level in ("basic_1_6", "nursery_kg"):
        return GRADE_THRESHOLDS_B16
    return GRADE_THRESHOLDS_B79


def get_grade_and_remark(score: float, thresholds: list) -> tuple:
    for threshold, grade, remark in thresholds:
        if score >= threshold:
            return grade, remark
    return thresholds[-1][1], thresholds[-1][2]


def get_overall_grade(avg: float, thresholds: list) -> str:
    return get_grade_and_remark(avg, thresholds)[0]


def fmt_pos(n):
    if n is None:
        return "-"
    suffix = (
        "th" if 10 <= n % 100 <= 20
        else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    )
    return f"{n}{suffix}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def make_para(styles):
    """Return a para() factory bound to a stylesheet."""
    def para(text, size=9, bold=False, color=DGRAY, align=TA_LEFT):
        return Paragraph(text, ParagraphStyle(
            "p", parent=styles["Normal"],
            fontSize=size,
            fontName="Helvetica-Bold" if bold else "Helvetica",
            textColor=color,
            alignment=align,
            leading=size + 3,
        ))
    return para


# ---------------------------------------------------------------------------
# PDF View
# ---------------------------------------------------------------------------

class StudentReportPDFView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        term = request.query_params.get("term")
        if not term:
            from rest_framework.response import Response
            return Response({"error": "term is required"}, status=400)

        student = get_object_or_404(Student, id=student_id)
        results = Result.objects.filter(student=student, term=term).select_related("subject")
        report  = Report.objects.filter(student=student, term=term).first()

        # Level-aware config
        level         = getattr(student.school_class, "level", "basic_7_9") if student.school_class else "basic_7_9"
        thresholds    = get_thresholds(level)
        show_position = level != "nursery_kg"
        school_name   = SCHOOL_NAMES.get(level, "LEADING STARS ACADEMY")
        school_motto  = SCHOOL_MOTTOS.get(level, "WHERE LEADERS ARE BORN")
        interp_rows   = INTERP_ROWS_B79 if level == "basic_7_9" else INTERP_ROWS_B16

        # ------------------------------
        # Attendance
        # ------------------------------

        term_attendance = Attendance.objects.filter(student=student, term=term)
        total_days      = term_attendance.count()
        present_days    = term_attendance.filter(status__in=["present", "late"]).count()
        att_percent     = round((present_days / total_days) * 100) if total_days else 0

        # ------------------------------
        # Results
        # ------------------------------

        subjects    = []
        total_score = 0
        passed      = 0
        failed      = 0

        for r in results:
            score          = r.score or 0
            grade, remark  = get_grade_and_remark(score, thresholds)

            subjects.append({
                "name":     r.subject.name,
                "reopen":   r.reopen,
                "ca":       r.ca,
                "exams":    r.exams,
                "score":    score,
                "grade":    grade,
                "remark":   remark,
                "position": r.subject_position if show_position else None,
            })
            total_score += score
            if score >= 50:
                passed += 1
            else:
                failed += 1

        subject_count = len(subjects)
        average       = round(total_score / subject_count, 1) if subject_count else 0
        overall_grade = get_overall_grade(average, thresholds)

        # ------------------------------
        # Class ranking
        # ------------------------------

        class_students = Student.objects.filter(school_class=student.school_class)
        student_totals = []

        for s in class_students:
            s_res = Result.objects.filter(student=s, term=term)
            student_totals.append({
                "student_id": s.id,
                "total":      sum(r.score or 0 for r in s_res),
            })

        ranked   = sorted(student_totals, key=lambda x: x["total"], reverse=True)
        position = next(
            (i + 1 for i, item in enumerate(ranked) if item["student_id"] == student.id),
            None,
        ) if show_position else None

        # ── Build PDF ──
        buffer = BytesIO()
        pdf    = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=12*mm, rightMargin=12*mm,
            topMargin=12*mm, bottomMargin=12*mm,
        )
        styles   = getSampleStyleSheet()
        elements = []
        para     = make_para(styles)

        # ── Header ──
        logo_img   = load_image_flowable(LOGO_PATH, width=22*mm, height=22*mm)
        logo_cell  = logo_img if logo_img else para("", 9)

        photo_img = None
        if student.photo:
            photo_url = student.photo.url
            if not photo_url.startswith("http"):
                photo_path = os.path.join(settings.MEDIA_ROOT, str(student.photo))
                photo_img  = load_image_flowable(photo_path, width=20*mm, height=22*mm)
            else:
                photo_img = load_image_flowable(photo_url, width=20*mm, height=22*mm)

        photo_cell = photo_img if photo_img else para("", 9)

        school_center = [
            para(school_name,                  15, bold=True,  color=BLUE, align=TA_CENTER),
            para(school_motto,                  8, bold=False, color=colors.HexColor("#92400e"), align=TA_CENTER),
            para("TERMINAL REPORT CARD",       11, bold=True,  color=GOLD, align=TA_CENTER),
            para(TERM_LABELS.get(term, term),   9, bold=False, color=DGRAY, align=TA_CENTER),
        ]

        header_table = Table([[logo_cell, school_center, photo_cell]], colWidths=[25*mm, 136*mm, 25*mm])
        header_table.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",         (0, 0), (0,  0),  "LEFT"),
            ("ALIGN",         (2, 0), (2,  0),  "RIGHT"),
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ("BOX",           (0, 0), (-1, -1), 0.8, BLUE),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (0,  0),  4),
            ("RIGHTPADDING",  (2, 0), (2,  0),  4),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 4*mm))

        # ── Student Info ──
        class_name = student.school_class.name if student.school_class else "-"
        position_text = (
            f"<b>POSITION:</b>  {fmt_pos(position)} out of {len(ranked)}"
            if show_position else
            "<b>POSITION:</b>  N/A"
        )
        info_rows = [
            [
                para(f"<b>NAME:</b>  {student.full_name}", 9),
                para(f"<b>TOTAL MARKS:</b>  {round(total_score, 1)}", 9, color=BLUE),
            ],
            [
                para(f"<b>STAGE:</b>  {class_name}", 9),
                para(f"<b>AVERAGE MARK:</b>  {average}  |  <b>GRADE:</b>  {overall_grade}", 9, color=BLUE),
            ],
            [
                para(f"<b>PUPILS ON ROLL:</b>  {len(ranked)}", 9),
                para(f"<b>TERM:</b>  {TERM_LABELS.get(term, term)}", 9),
            ],
            [
                para(f"<b>ADMISSION NO:</b>  {student.admission_number}", 9),
                para(position_text, 9, color=BLUE),
            ],
        ]
        info_table = Table(info_rows, colWidths=[93*mm, 93*mm])
        info_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("BOX",  (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 4*mm))

        # ── Subject Table ──
        subj_header = [
            para("SUBJECT",            8, bold=True, color=BLUE),
            para("RE-OPEN\n& RDA 20%", 7, bold=True, color=BLUE, align=TA_CENTER),
            para("CA/MGT\n40%",        7, bold=True, color=BLUE, align=TA_CENTER),
            para("EXAMS\n40%",         7, bold=True, color=BLUE, align=TA_CENTER),
            para("TOTAL\n100%",        7, bold=True, color=BLUE, align=TA_CENTER),
            para("GRADE",              7, bold=True, color=BLUE, align=TA_CENTER),
            para("REMARK",             7, bold=True, color=BLUE, align=TA_CENTER),
        ]

        if show_position:
            subj_header.insert(5, para("POSITION", 7, bold=True, color=BLUE, align=TA_CENTER))

        col_widths = (
            [48*mm, 18*mm, 18*mm, 18*mm, 18*mm, 14*mm, 14*mm, 34*mm]
            if show_position else
            [52*mm, 20*mm, 20*mm, 20*mm, 20*mm, 16*mm, 38*mm]
        )

        subj_rows = [subj_header]
        for sub in subjects:
            row = [
                para(sub["name"],                 8),
                para(str(sub["reopen"]),          8, align=TA_CENTER),
                para(str(sub["ca"]),              8, align=TA_CENTER),
                para(str(sub["exams"]),           8, align=TA_CENTER),
                para(f'<b>{sub["score"]}</b>',    8, color=BLUE, align=TA_CENTER),
                para(f'<b>{sub["grade"]}</b>',    8, color=BLUE, align=TA_CENTER),
                para(sub["remark"],               7, align=TA_CENTER),
            ]
            if show_position:
                row.insert(5, para(str(sub["position"] or "-"), 8, align=TA_CENTER))
            subj_rows.append(row)

        subj_table = Table(subj_rows, colWidths=col_widths)
        subj_table.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0), (-1, 0), LBLUE),
            ("GRID",           (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ("BOX",            (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("TOPPADDING",     (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 4),
            ("LEFTPADDING",    (0, 0), (-1, -1), 4),
            ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY]),
        ]))
        elements.append(subj_table)
        elements.append(Spacer(1, 4*mm))

        # ── Attendance + Remarks ──
        att_rows = [[para("Attendance", 9, bold=True, color=BLUE)]]
        if total_days > 0:
            att_rows.append([para(f"Days Present:  <b>{present_days}</b> out of <b>{total_days}</b>  ({att_percent}%)", 9)])
            att_rows.append([para(f"Days Absent:  <b>{total_days - present_days}</b>", 9, color=colors.HexColor("#dc2626"))])
        else:
            att_rows.append([para("No attendance data recorded.", 9, color=colors.HexColor("#9ca3af"))])

        if report:
            if report.conduct:
                att_rows.append([para(f"<b>ATTITUDE:</b>  {report.conduct}", 9, color=BLUE)])
            if report.interest:
                att_rows.append([para(f"<b>INTEREST:</b>  {report.interest}", 9, color=BLUE)])

        rem_rows = [[para("Class Teacher Remarks", 9, bold=True, color=BLUE)]]
        if report and report.teacher_remark:
            rem_rows.append([para(f'"{report.teacher_remark}"', 9, color=DGRAY)])
        else:
            rem_rows.append([para("No remarks recorded.", 9, color=colors.HexColor("#9ca3af"))])

        att_inner = Table(att_rows, colWidths=[88*mm])
        rem_inner = Table(rem_rows, colWidths=[88*mm])
        for t in (att_inner, rem_inner):
            t.setStyle(TableStyle([
                ("TOPPADDING",    (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ]))

        bottom_table = Table([[att_inner, rem_inner]], colWidths=[93*mm, 93*mm])
        bottom_table.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("BOX",  (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ("BACKGROUND",    (0, 0), (-1, -1), GRAY),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(bottom_table)
        elements.append(Spacer(1, 4*mm))

        # ── Result Interpretation ──
        interp_data = [[
            para("RESULT INTERPRETATION", 8, bold=True, color=BLUE),
            para(""), para(""), para(""), para(""), para(""),
        ]]
        for row in interp_rows:
            interp_data.append([
                para(row[0], 7), para(row[1], 7), para(row[2], 7),
                para(""), para(""), para(""),
            ])

        interp_table = Table(interp_data, colWidths=[31*mm]*6)
        interp_table.setStyle(TableStyle([
            ("SPAN",          (0, 0), (-1, 0)),
            ("BACKGROUND",    (0, 0), (-1, 0), LBLUE),
            ("BACKGROUND",    (0, 1), (-1, -1), GRAY),
            ("BOX",  (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ]))
        elements.append(interp_table)

        # ── Footer ──
        elements.append(Spacer(1, 4*mm))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d1d5db")))
        elements.append(Spacer(1, 2*mm))
        elements.append(para(
            "This report was generated automatically by the School Management System.",
            7, color=colors.HexColor("#9ca3af"), align=TA_CENTER,
        ))

        pdf.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="report_{student.admission_number}_{term}.pdf"'
        )
        return response