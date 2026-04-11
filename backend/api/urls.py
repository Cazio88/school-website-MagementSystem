from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views.student_view import StudentViewSet
from api.views.teacher_view import TeacherViewSet
from api.views.class_view import ClassViewSet
from api.views.subject_view import SubjectViewSet
from api.views.attendance_view import AttendanceViewSet
from api.views.result_view import ResultViewSet
from api.views.fee_view import FeeViewSet
from api.views.announcement_view import AnnouncementViewSet
from api.views.admission_view import AdmissionViewSet
from rest_framework_simplejwt.views import TokenRefreshView
from api.views.dashboard_view import DashboardView
from api.views.auth_view import RegisterView, MeView, LoginView, AdminApprovalViewSet
from api.views.report_view import StudentReportView
from api.views.report_pdf_view import StudentReportPDFView
from api.views.bill_pdf_view import StudentFeeBillPDFView, ClassFeeBillPDFView
from api.views.receipt_pdf_view import PaymentReceiptPDFView
from api.views.admission_form_pdf_view import AdmissionFormPDFView
from api.views.accounts_view import (
    AccountsDashboardView,
    IncomeLedgerView,
    FeeCollectionReportView,
    DefaultersListView,
)

router = DefaultRouter()
router.register("students",        StudentViewSet)
router.register("teachers",        TeacherViewSet)
router.register("classes",         ClassViewSet)
router.register("subjects",        SubjectViewSet)
router.register("attendance",      AttendanceViewSet)
router.register("results",         ResultViewSet)
router.register("fees",            FeeViewSet)
router.register("announcements",   AnnouncementViewSet)
router.register("admissions",      AdmissionViewSet)
router.register("admin-approvals", AdminApprovalViewSet, basename="admin-approvals")

urlpatterns = [
    path("results/bulk/", ResultViewSet.as_view({"post": "bulk_save"})),
    path("admissions/<int:admission_id>/form/", AdmissionFormPDFView.as_view()),
    path("", include(router.urls)),
    path("dashboard/", DashboardView.as_view()),
    path("auth/login/",    LoginView.as_view()),
    path("auth/refresh/",  TokenRefreshView.as_view()),
    path("auth/register/", RegisterView.as_view()),
    path("auth/me/",       MeView.as_view()),
    path("report/student/<int:student_id>/",      StudentReportView.as_view()),
    path("report/student/<int:student_id>/pdf/",  StudentReportPDFView.as_view()),
    path("fees/bill/student/<int:student_id>/",   StudentFeeBillPDFView.as_view()),
    path("fees/bill/class/",                      ClassFeeBillPDFView.as_view()),
    path("fees/receipt/<int:transaction_id>/",    PaymentReceiptPDFView.as_view()),
    path("accounts/dashboard/",  AccountsDashboardView.as_view()),
    path("accounts/ledger/",     IncomeLedgerView.as_view()),
    path("accounts/collection/", FeeCollectionReportView.as_view()),
    path("accounts/defaulters/", DefaultersListView.as_view()),
]
