from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.db.models import Sum, Count, Q

from decimal import Decimal

from apps.fees.models import Fee, PaymentTransaction
from apps.students.models import Student
from api.serializers.fee_serializer import FeeSerializer


def to_decimal(value, default=Decimal("0")):
    try:
        return Decimal(str(value)) if value not in (None, "") else default
    except Exception:
        return default


class FeeViewSet(ModelViewSet):

    queryset           = Fee.objects.all().select_related("student")
    serializer_class   = FeeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs     = super().get_queryset()
        params = self.request.query_params

        student      = params.get("student")
        term         = params.get("term")
        school_class = params.get("school_class")
        status_param = params.get("status")

        if student:      qs = qs.filter(student_id=student)
        if term:         qs = qs.filter(term=term)
        if school_class: qs = qs.filter(student__school_class_id=school_class)

        if status_param == "paid":
            qs = qs.filter(balance__lte=0)
        elif status_param == "partial":
            qs = qs.filter(paid__gt=0, balance__gt=0)
        elif status_param == "unpaid":
            qs = qs.filter(paid=0)

        return qs

    # ------------------------------------------------------------------
    # Record a payment
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        fee    = self.get_object()
        amount = request.data.get("amount")
        note   = request.data.get("note", "")

        if amount is None:
            return Response({"error": "amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount))
        except (TypeError, ValueError):
            return Response({"error": "amount must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"error": "amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

        if amount > fee.balance:
            return Response(
                {"error": f"Amount exceeds outstanding balance of {fee.balance}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fee.paid += amount
        fee.save()

        txn = PaymentTransaction.objects.create(
            fee         = fee,
            amount      = amount,
            note        = note,
            recorded_by = request.user if request.user.is_authenticated else None,
        )

        # transaction_id is returned so the frontend can immediately
        # request the receipt PDF at /fees/receipt/<transaction_id>/
        return Response({
            **FeeSerializer(fee).data,
            "transaction_id": txn.id,
        })

    # ------------------------------------------------------------------
    # List payment transactions for a fee record
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"], url_path="transactions")
    def transactions(self, request, pk=None):
        fee          = self.get_object()
        transactions = fee.transactions.select_related("recorded_by").all()

        data = [
            {
                "id":          t.id,
                "amount":      str(t.amount),
                "note":        t.note,
                "recorded_by": (
                    t.recorded_by.get_full_name() or t.recorded_by.username
                    if t.recorded_by else "System"
                ),
                "created_at":  t.created_at.strftime("%d %b %Y, %I:%M %p"),
                "date":        t.created_at.strftime("%d %b %Y"),
                "time":        t.created_at.strftime("%I:%M %p"),
            }
            for t in transactions
        ]

        return Response(data)

    # ------------------------------------------------------------------
    # Assign fee to a single student
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"], url_path="assign-student")
    def assign_student(self, request):
        student_id = request.data.get("student")
        term       = request.data.get("term")
        amount     = request.data.get("amount")

        if not all([student_id, term, amount]):
            return Response(
                {"error": "student, term and amount are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        fee, is_new = Fee.objects.get_or_create(
            student=student,
            term=term,
            defaults={
                "amount":        to_decimal(amount),
                "book_user_fee": to_decimal(request.data.get("book_user_fee")),
                "workbook_fee":  to_decimal(request.data.get("workbook_fee")),
                "arrears":       to_decimal(request.data.get("arrears")),
                "paid":          Decimal("0"),
            },
        )

        if not is_new:
            fee.amount        = to_decimal(amount)
            fee.book_user_fee = to_decimal(request.data.get("book_user_fee"), fee.book_user_fee)
            fee.workbook_fee  = to_decimal(request.data.get("workbook_fee"),  fee.workbook_fee)
            fee.arrears       = to_decimal(request.data.get("arrears"),       fee.arrears)
            fee.save()

        return Response(
            FeeSerializer(fee).data,
            status=status.HTTP_201_CREATED if is_new else status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Bulk assign fees to a whole class
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        school_class = request.data.get("school_class")
        term         = request.data.get("term")
        amount       = request.data.get("amount")

        if not all([school_class, term, amount]):
            return Response(
                {"error": "school_class, term and amount are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount        = Decimal(str(amount))
            book_user_fee = to_decimal(request.data.get("book_user_fee"))
            workbook_fee  = to_decimal(request.data.get("workbook_fee"))
        except (TypeError, ValueError):
            return Response({"error": "Fee values must be numbers"}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"error": "amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(school_class_id=school_class)
        if not students.exists():
            return Response({"error": "No students found for this class"}, status=status.HTTP_404_NOT_FOUND)

        created = updated = 0

        for student in students:
            fee, is_new = Fee.objects.get_or_create(
                student=student,
                term=term,
                defaults={
                    "amount":        amount,
                    "book_user_fee": book_user_fee,
                    "workbook_fee":  workbook_fee,
                    "paid":          Decimal("0"),
                },
            )
            if not is_new:
                fee.amount        = amount
                fee.book_user_fee = book_user_fee
                fee.workbook_fee  = workbook_fee
                fee.save()
                updated += 1
            else:
                created += 1

        return Response({"created": created, "updated": updated, "total": created + updated})

    # ------------------------------------------------------------------
    # Add arrears to a specific student fee record
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="add-arrears")
    def add_arrears(self, request, pk=None):
        fee     = self.get_object()
        arrears = request.data.get("arrears")

        if arrears is None:
            return Response({"error": "arrears is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            arrears = Decimal(str(arrears))
        except (TypeError, ValueError):
            return Response({"error": "arrears must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        if arrears < 0:
            return Response({"error": "arrears cannot be negative"}, status=status.HTTP_400_BAD_REQUEST)

        fee.arrears = arrears
        fee.save()
        return Response(FeeSerializer(fee).data)

    # ------------------------------------------------------------------
    # Summary stats for a class + term
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

        fees = Fee.objects.filter(
            student__school_class_id=school_class,
            term=term,
        ).select_related("student")

        agg = fees.aggregate(
            total_fees     = Sum("amount"),
            total_books    = Sum("book_user_fee"),
            total_wb       = Sum("workbook_fee"),
            total_arrears  = Sum("arrears"),
            total_paid     = Sum("paid"),
            total_balance  = Sum("balance"),
            total_students = Count("id"),
            fully_paid     = Count("id", filter=Q(balance__lte=0)),
            partial        = Count("id", filter=Q(paid__gt=0, balance__gt=0)),
            unpaid         = Count("id", filter=Q(paid=0)),
        )

        total_expected = (
            (agg["total_fees"]    or 0) +
            (agg["total_books"]   or 0) +
            (agg["total_wb"]      or 0) +
            (agg["total_arrears"] or 0)
        )

        # Recent payments across this class+term (last 20)
        recent_payments = (
            PaymentTransaction.objects
            .filter(fee__in=fees)
            .select_related("fee__student", "recorded_by")
            .order_by("-created_at")[:20]
        )
        recent = [
            {
                "id":           t.id,
                "student_name": t.fee.student.full_name,
                "amount":       str(t.amount),
                "note":         t.note,
                "recorded_by":  (
                    t.recorded_by.get_full_name() or t.recorded_by.username
                    if t.recorded_by else "System"
                ),
                "created_at":   t.created_at.strftime("%d %b %Y, %I:%M %p"),
            }
            for t in recent_payments
        ]

        return Response({
            "total_expected":  total_expected,
            "total_fees":      agg["total_fees"]     or 0,
            "total_books":     agg["total_books"]    or 0,
            "total_workbooks": agg["total_wb"]       or 0,
            "total_arrears":   agg["total_arrears"]  or 0,
            "total_paid":      agg["total_paid"]     or 0,
            "total_balance":   agg["total_balance"]  or 0,
            "total_students":  agg["total_students"] or 0,
            "fully_paid":      agg["fully_paid"]     or 0,
            "partial":         agg["partial"]        or 0,
            "unpaid":          agg["unpaid"]         or 0,
            "recent_payments": recent,
            "records":         FeeSerializer(fees, many=True).data,
        })