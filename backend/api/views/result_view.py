from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from django.db.models import Sum
from django.shortcuts import get_object_or_404

from apps.results.models import Result, Report
from apps.students.models import Student
from api.serializers.result_serializer import ResultSerializer


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GRADE_THRESHOLDS = [
    (90, "1"),
    (80, "2"),
    (60, "3"),
    (55, "4"),
    (50, "5"),
    (45, "6"),
    (40, "7"),
    (35, "8"),
    (0,  "9"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _overall_grade(avg: float) -> str:
    """Return the grade string for a given average score."""
    for threshold, grade in GRADE_THRESHOLDS:
        if avg >= threshold:
            return grade
    return "9"


def _fmt_position(n: int | None) -> str:
    """Return '1st', '2nd', '3rd', '4th', … or '-' for None."""
    if n is None:
        return "-"
    suffix = (
        "th"
        if 10 <= n % 100 <= 20
        else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    )
    return f"{n}{suffix}"


def recompute_subject_positions(
    subject_id: int,
    term: str,
    school_class_id: int,
) -> None:
    """
    Rank all results for a given subject/term/class by score descending.
    Tied scores receive the same position (dense ranking).
    """
    results = list(
        Result.objects.filter(
            subject_id=subject_id,
            term=term,
            school_class_id=school_class_id,
        ).order_by("-score", "id")   # stable secondary sort
    )

    current_rank = 0
    prev_score   = object()          # sentinel — never equal to a real score

    for i, r in enumerate(results):
        if r.score != prev_score:
            current_rank = i + 1
            prev_score   = r.score
        r.subject_position = current_rank

    Result.objects.bulk_update(results, ["subject_position"])


def _assign_ranks(rows: list[dict], key: str = "total_score") -> None:
    """
    Add a 'rank' key to each dict in *rows* (sorted descending by *key*).
    Equal values share the same rank (standard competition ranking).
    Mutates the list in-place.
    """
    current_rank = 0
    prev_value   = object()

    for i, row in enumerate(rows):
        if row[key] != prev_value:
            current_rank = i + 1
            prev_value   = row[key]
        row["rank"] = current_rank


# ---------------------------------------------------------------------------
# ViewSet
# ---------------------------------------------------------------------------

class ResultViewSet(ModelViewSet):

    queryset           = Result.objects.all().order_by("-created_at")
    serializer_class   = ResultSerializer
    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # Queryset filtering
    # ------------------------------------------------------------------

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        student      = params.get("student")
        school_class = params.get("school_class")
        term         = params.get("term")
        subject      = params.get("subject")

        if student:      qs = qs.filter(student_id=student)
        if school_class: qs = qs.filter(school_class_id=school_class)
        if term:         qs = qs.filter(term=term)
        if subject:      qs = qs.filter(subject_id=subject)
        return qs

    # ------------------------------------------------------------------
    # Single-record create / update
    # ------------------------------------------------------------------

    def perform_create(self, serializer):
        instance = serializer.save()
        recompute_subject_positions(
            instance.subject_id, instance.term, instance.school_class_id
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        recompute_subject_positions(
            instance.subject_id, instance.term, instance.school_class_id
        )

    # ------------------------------------------------------------------
    # Bulk upsert
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"], url_path="bulk-save")  # fix: was missing @action
    def bulk_save(self, request):
        records = request.data if isinstance(request.data, list) else [request.data]

        saved  = []
        errors = []

        for record in records:
            # Validate required keys before attempting the DB call
            missing = [k for k in ("student", "subject", "term") if k not in record]
            if missing:
                errors.append({"record": record, "error": f"Missing fields: {missing}"})
                continue

            try:
                instance, _ = Result.objects.update_or_create(
                    student_id=record["student"],
                    subject_id=record["subject"],
                    term=record["term"],
                    defaults={
                        "school_class_id": record.get("school_class"),
                        "reopen": float(record.get("reopen") or 0),
                        "ca":     float(record.get("ca")     or 0),
                        "exams":  float(record.get("exams")  or 0),
                    },
                )
                saved.append(instance.id)
            except Exception as exc:
                errors.append({"record": record, "error": str(exc)})

        # Recompute positions for every affected subject/term/class combo
        combos = {
            (r["subject"], r["term"], r.get("school_class"))
            for r in records
            if "subject" in r and "term" in r
        }
        for subject_id, term, class_id in combos:
            recompute_subject_positions(subject_id, term, class_id)

        response_status = (
            status.HTTP_400_BAD_REQUEST if not saved and errors
            else status.HTTP_207_MULTI_STATUS if errors
            else status.HTTP_200_OK
        )
        return Response({"saved": len(saved), "errors": errors}, status=response_status)

    # ------------------------------------------------------------------
    # Class summary (ranked)
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        school_class = request.query_params.get("school_class")
        term         = request.query_params.get("term")

        if not school_class or not term:
            return Response(
                {"error": "school_class and term are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = (
            Result.objects
            .filter(school_class_id=school_class, term=term)
            .select_related("student", "student__user", "subject")
        )

        student_map: dict = {}

        for r in results:
            sid = r.student.id

            if sid not in student_map:
                student_map[sid] = {
                    "student_id":       r.student.id,
                    "student_name":     r.student.full_name,
                    "admission_number": r.student.admission_number,
                    "subjects":         [],
                    "total_score":      0,
                    "count":            0,
                }

            student_map[sid]["subjects"].append({
                "subject_id":       r.subject.id,
                "subject_name":     r.subject.name,
                "reopen":           r.reopen,
                "ca":               r.ca,
                "exams":            r.exams,
                "score":            r.score,
                "grade":            r.grade,
                "remark":           r.remark,
                "subject_position": r.subject_position,
            })

            # fix: don't count None-score subjects toward the average
            if r.score is not None:
                student_map[sid]["total_score"] += r.score
                student_map[sid]["count"]        += 1

        rows = []
        for data in student_map.values():
            count = data["count"]
            total = round(data["total_score"], 1)
            avg   = round(total / count, 1) if count else 0

            rows.append({
                "student_id":       data["student_id"],
                "student_name":     data["student_name"],
                "admission_number": data["admission_number"],
                "subjects":         data["subjects"],
                "total_score":      total,
                "average_score":    avg,
                "overall_grade":    _overall_grade(avg),
                "subject_count":    count,
            })

        rows.sort(key=lambda x: x["total_score"], reverse=True)
        _assign_ranks(rows)
        return Response(rows)


# ---------------------------------------------------------------------------
# Per-student report card
# ---------------------------------------------------------------------------

class StudentReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        term = request.query_params.get("term")
        if not term:
            raise ValidationError({"error": "term is required"})

        # fix: raises 404 instead of unhandled DoesNotExist
        student = get_object_or_404(Student, id=student_id)

        results = (
            Result.objects
            .filter(student=student, term=term)
            .select_related("subject")
        )

        subjects    = []
        total_score = 0
        passed      = 0
        failed      = 0

        for r in results:
            score = r.score or 0    # fix: guard against None before arithmetic
            subjects.append({
                "subject":          r.subject.name,
                "reopen":           r.reopen,
                "ca":               r.ca,
                "exams":            r.exams,
                "score":            r.score,
                "grade":            r.grade,
                "remark":           r.remark,
                "subject_position": r.subject_position,
            })
            total_score += score
            if score >= 50:
                passed += 1
            else:
                failed += 1

        subject_count = len(subjects)
        average       = round(total_score / subject_count, 1) if subject_count else 0

        # fix: single aggregation query instead of N per-student queries
        class_totals = (
            Result.objects
            .filter(
                student__school_class=student.school_class,
                term=term,
            )
            .values("student_id")
            .annotate(total=Sum("score"))
            .order_by("-total")
        )

        ranked = list(class_totals)
        ranked.sort(key=lambda x: x["total"] or 0, reverse=True)

        # Assign dense ranks to the aggregated list
        _assign_ranks(ranked, key="total")
        position = next(
            (row["rank"] for row in ranked if row["student_id"] == student.id),
            None,
        )

        report = Report.objects.filter(student=student, term=term).first()

        return Response({
            "student":            student.full_name,
            "admission_number":   student.admission_number,
            "class":              student.school_class.name if student.school_class else None,
            "photo":              student.photo.url if student.photo else None,
            "term":               term,
            "subjects":           subjects,
            "total_score":        round(total_score, 1),
            "average_score":      average,
            "overall_grade":      _overall_grade(average),  # bonus: was missing from report
            "subjects_passed":    passed,
            "subjects_failed":    failed,
            "position":           position,
            "position_formatted": _fmt_position(position),
            "out_of":             len(ranked),
            "attendance":         report.attendance       if report else None,
            "attendance_total":   report.attendance_total if report else None,
            "interest":           report.interest         if report else None,
            "conduct":            report.conduct          if report else None,
            "teacher_remark":     report.teacher_remark   if report else None,
        })