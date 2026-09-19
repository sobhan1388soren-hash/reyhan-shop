import { requireAdmin } from "@/lib/admin/dal";
import { userDisplayName } from "@/lib/auth/dal";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Phase 13 dashboard foundation — honest, real empty states only.
// No fake metrics: product/order/customer modules arrive in Phase 14.

export default async function AdminDashboardPage() {
  const user = await requireAdmin();

  return (
    <div>
      <AdminPageHeader
        title="داشبورد مدیریت"
        description={`خوش آمدید، ${userDisplayName(user)}. مدیریت ریحان آماده است.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminEmptyState
          className="h-full"
          title="بخش محصولات"
          description="مدیریت محصولات، دسته‌بندی‌ها و موجودی در فاز بعدی فعال می‌شود."
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M4 8l8 4.5L20 8M12 12.5V20.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          }
        />
        <AdminEmptyState
          className="h-full"
          title="بخش سفارش‌ها"
          description="مشاهده و پیگیری سفارش‌ها از بخش مدیریت سفارش‌ها فعال است؛ عملیات تغییر وضعیت در فازهای بعدی افزوده می‌شود."
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M5 8h14l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5L5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <AdminEmptyState
          className="h-full"
          title="بخش کاربران"
          description="مشاهده حساب‌های کاربری فعال است؛ مدیریت عملیاتی (مسدودسازی/نقش‌ها) در فازهای بعدی اضافه می‌شود."
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.5 20c.7-3.1 3-4.8 5.5-4.8s4.8 1.7 5.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <AdminEmptyState
          className="h-full"
          title="بخش تخفیف‌ها"
          description="رابط مدیریت کدهای تخفیف (قوانین فاز ۱۲ آماده است) در فاز بعدی ساخته می‌شود."
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h7.2a1.5 1.5 0 0 1 1.06.44l7.1 7.1a1.5 1.5 0 0 1 0 2.12l-5.2 5.2a1.5 1.5 0 0 1-2.12 0l-7.1-7.1A1.5 1.5 0 0 1 4 10.6V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="8.4" cy="8.4" r="1.4" fill="currentColor" />
            </svg>
          }
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>وضعیت پنل</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            ورود مدیران با همان سیستم احراز هویت موبایل (شماره + کد یک‌بارمصرف) انجام
            می‌شود. دسترسی بر اساس نقش ثبت‌شده در پایگاه داده کنترل می‌شود و بخش‌های
            مدیریتی عملیاتی در فاز بعدی اضافه خواهند شد.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
