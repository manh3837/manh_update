import React from "react"
import { Navigate, useLocation } from "react-router-dom"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: "admin" | "manager" | "customer"
  allowedRoles?: Array<"admin" | "manager" | "customer">
  fallbackPath?: string
}

/**
 * Component bảo vệ trang (Auth Guard)
 * - Nếu chưa đăng nhập: Chuyển hướng người dùng về trang /login
 * - Nếu không có quyền phù hợp: Chuyển hướng về fallbackPath hoặc trang chủ
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  allowedRoles,
  fallbackPath,
}) => {
  const location = useLocation()

  // Đọc thông tin đăng nhập từ localStorage
  const savedUser = localStorage.getItem("user")
  let user: { role?: "admin" | "manager" | "customer" | string } | null = null

  try {
    user = savedUser ? JSON.parse(savedUser) : null
  } catch {
    user = null
  }

  // 1. Chưa đăng nhập -> Chuyển về trang đăng nhập
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 2. Kiểm tra quyền truy cập theo danh sách vai trò cho phép
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user.role || !allowedRoles.includes(user.role as any)) {
      const redirectTarget = fallbackPath || (user.role === "manager" ? "/admin" : "/homepage")
      return <Navigate to={redirectTarget} replace />
    }
  }

  // 3. Kiểm tra quyền truy cập theo vai trò bắt buộc đơn lẻ
  if (requiredRole && user.role !== requiredRole) {
    const redirectTarget = fallbackPath || (user.role === "manager" ? "/admin" : "/homepage")
    return <Navigate to={redirectTarget} replace />
  }

  // 4. Đã xác thực hợp lệ -> Cho phép truy cập vào trang con
  return <>{children}</>
}
