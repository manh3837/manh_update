import { useCallback, useEffect, useState } from "react"
import {
    Search,
    Edit2,
    RefreshCw,
    Loader2,
    AlertCircle,
    AlertTriangle,
    Trash2,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { authService } from "@/services/auth.service"
import {
    userService,
    type AdminRole,
    type AdminStatus,
    type AdminUser,
    type AdminUserStats,
} from "@/services/user.service"

const EMPTY_STATS: AdminUserStats = {
    total: 0,
    customer: 0,
    manager: 0,
    admin: 0,
    active: 0,
    locked: 0,
    unverified: 0,
}

const ROLE_LABEL: Record<AdminRole, string> = {
    customer: "Khách hàng",
    manager: "Quản lý rạp",
    admin: "Quản trị viên",
}

const ROLE_BADGE: Record<AdminRole, string> = {
    admin: "border-[#2a3c25] bg-[#162518] text-[#caef6b]",
    manager: "border-[#3b3a60] bg-[#1f1d38] text-[#a78bfa]",
    customer: "border-[#243041] bg-[#1a2431] text-[#9ba9ba]",
}

const STATUS_LABEL: Record<AdminStatus, string> = {
    active: "Hoạt động",
    locked: "Tạm khóa",
    unverified: "Chưa xác minh",
}

const STATUS_DOT: Record<AdminStatus, string> = {
    active: "bg-[#caef6b]",
    locked: "bg-[#ff8e8e]",
    unverified: "bg-[#ffbd7a]",
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 0) return "U"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDateTime(value: string): string {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export const AdminUsersPage = () => {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [stats, setStats] = useState<AdminUserStats>(EMPTY_STATS)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [activeTab, setActiveTab] = useState<"all" | AdminRole>("all")
    const [searchTerm, setSearchTerm] = useState("")

    // Tài khoản đang chọn + form chỉnh sửa
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [formName, setFormName] = useState("")
    const [formEmail, setFormEmail] = useState("")
    const [formPhone, setFormPhone] = useState("")
    const [formRole, setFormRole] = useState<AdminRole>("customer")
    const [formStatus, setFormStatus] = useState<AdminStatus>("active")
    const [isSaving, setIsSaving] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)

    // Xóa tài khoản
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    // Chỉ bật khi admin tích "xóa cả đơn đặt vé" (tài khoản có booking)
    const [forceDelete, setForceDelete] = useState(false)

    const currentUserId = authService.getCurrentUser()?.id
    const selectedUser = users.find((user) => user.id === selectedId) || null

    const applyUserToForm = (user: AdminUser) => {
        setSelectedId(user.id)
        setFormName(user.name)
        setFormEmail(user.email)
        setFormPhone(user.phone)
        setFormRole(user.role)
        setFormStatus(user.status)
        setNotice(null)
    }

    const loadUsers = useCallback(async (keepSelectionId?: number | null) => {
        setIsLoading(true)
        setError(null)

        const res = await userService.getUsers()
        if (res.success && res.data) {
            const list = res.data.users
            setUsers(list)
            setStats(res.data.stats)

            const stillThere = keepSelectionId
                ? list.find((user) => user.id === keepSelectionId)
                : undefined
            const target = stillThere || list[0]
            if (target) applyUserToForm(target)
            else setSelectedId(null)
        } else {
            setError(
                res.message ||
                "Không tải được danh sách người dùng. Vui lòng đăng nhập bằng tài khoản admin."
            )
        }

        setIsLoading(false)
    }, [])

    useEffect(() => {
        void loadUsers(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedId) {
            setError("Vui lòng chọn một tài khoản để chỉnh sửa.")
            return
        }

        if (!formName.trim() || !formEmail.trim()) {
            setError("Họ tên và email không được để trống.")
            return
        }

        setIsSaving(true)
        setError(null)
        setNotice(null)

        const res = await userService.updateUser(selectedId, {
            name: formName.trim(),
            email: formEmail.trim().toLowerCase(),
            phone: formPhone.trim(),
            role: formRole,
            status: formStatus,
        })

        setIsSaving(false)

        if (res.success) {
            await loadUsers(selectedId)
            setNotice("Đã lưu thay đổi vào database.")
        } else {
            setError(res.message || "Không thể cập nhật tài khoản. Vui lòng thử lại.")
        }
    }

    const handleDeleteUser = async () => {
        if (!selectedId) return

        setIsDeleting(true)
        setDeleteError(null)

        const res = await userService.deleteUser(selectedId, forceDelete)
        setIsDeleting(false)

        if (res.success) {
            setIsDeleteOpen(false)
            setForceDelete(false)
            await loadUsers(null)
            setNotice(res.message || "Đã xóa tài khoản.")
            return
        }

        setDeleteError(res.message || "Không thể xóa tài khoản. Vui lòng thử lại.")
    }

    const filteredUsers = users.filter((user) => {
        const matchesTab = activeTab === "all" || user.role === activeTab
        const keyword = searchTerm.trim().toLowerCase()
        const matchesSearch =
            !keyword ||
            user.name.toLowerCase().includes(keyword) ||
            user.email.toLowerCase().includes(keyword) ||
            (user.phone || "").includes(keyword)
        return matchesTab && matchesSearch
    })

    return (
        <div className="space-y-8">
            {/* 1. Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                        ĐỊNH DANH & PHÂN QUYỀN TRUY CẬP
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                        Đúng người. Đúng quyền.
                    </h1>
                    <p className="mt-1 text-xs text-[#9ba9ba]">
                        Danh sách tài khoản lấy trực tiếp từ database · {stats.total} tài khoản
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void loadUsers(selectedId)}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#243041] bg-[#121923] px-4 py-2 text-xs font-semibold text-[#d3dce7] transition-colors hover:border-[#caef6b]/40 hover:text-white disabled:opacity-50"
                >
                    <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                    Làm mới
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-4 py-3 text-xs text-[#ffb4b4]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* 2. Main Grid: Users List (Col 8), Edit Panel (Col 4) */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left Column: Filter & Table */}
                <div className="space-y-4 lg:col-span-8">
                    {/* Tabs & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#1f2c3d] bg-[#121923] p-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab("all")}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTab === "all"
                                    ? "bg-[#caef6b] text-[#090d14]"
                                    : "text-[#9ba9ba] hover:text-white"
                                    }`}
                            >
                                Tất cả ({stats.total})
                            </button>
                            <button
                                onClick={() => setActiveTab("customer")}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTab === "customer"
                                    ? "bg-[#caef6b] text-[#090d14]"
                                    : "text-[#9ba9ba] hover:text-white"
                                    }`}
                            >
                                Khách hàng ({stats.customer})
                            </button>
                            <button
                                onClick={() => setActiveTab("manager")}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTab === "manager"
                                    ? "bg-[#caef6b] text-[#090d14]"
                                    : "text-[#9ba9ba] hover:text-white"
                                    }`}
                            >
                                Quản lý ({stats.manager || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("admin")}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTab === "admin"
                                    ? "bg-[#caef6b] text-[#090d14]"
                                    : "text-[#9ba9ba] hover:text-white"
                                    }`}
                            >
                                Quản trị viên ({stats.admin})
                            </button>
                        </div>

                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 size-3.5 text-[#9ba9ba]" />
                            <Input
                                placeholder="Tìm tên, email, SĐT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs bg-[#090d14]"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-3xl border border-[#1f2c3d] bg-[#121923] shadow-xl">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-[#1f2c3d] bg-[#0c121a] text-[11px] font-bold uppercase text-[#9ba9ba]">
                                <tr>
                                    <th className="p-4">Tài khoản</th>
                                    <th className="p-4">Vai trò</th>
                                    <th className="p-4">Trạng thái</th>
                                    <th className="p-4">Cập nhật gần nhất</th>
                                    <th className="p-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f2c3d]/60">
                                {isLoading && users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-[#9ba9ba]">
                                            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-[#caef6b]" />
                                            Đang tải tài khoản từ database...
                                        </td>
                                    </tr>
                                )}

                                {!isLoading && filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-[#9ba9ba]">
                                            Không tìm thấy tài khoản phù hợp.
                                        </td>
                                    </tr>
                                )}

                                {filteredUsers.map((user) => {
                                    const isSelected = selectedId === user.id
                                    return (
                                        <tr
                                            key={user.id}
                                            onClick={() => applyUserToForm(user)}
                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-[#17261a]" : "hover:bg-[#16202c]"
                                                }`}
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="size-8 border border-[#243041]">
                                                        <AvatarFallback className="bg-[#1f2c3d] text-xs font-bold text-[#caef6b]">
                                                            {initialsOf(user.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-bold text-white hover:text-[#caef6b]">
                                                            {user.name}
                                                        </div>
                                                        <div className="text-[10px] text-[#9ba9ba]">
                                                            {user.email}
                                                            {user.phone ? ` · ${user.phone}` : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <Badge className={`text-[10px] font-bold ${ROLE_BADGE[user.role]}`}>
                                                    {ROLE_LABEL[user.role]}
                                                </Badge>
                                            </td>

                                            <td className="p-4">
                                                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#d3dce7]">
                                                    <span className={`size-1.5 rounded-full ${STATUS_DOT[user.status]}`} />
                                                    {STATUS_LABEL[user.status]}
                                                </span>
                                            </td>

                                            <td className="p-4 text-[#9ba9ba]">{formatDateTime(user.updated_at)}</td>

                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            applyUserToForm(user)
                                                        }}
                                                        title="Chỉnh sửa tài khoản"
                                                        className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#1f2c3d] hover:text-[#caef6b]"
                                                    >
                                                        <Edit2 className="size-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            applyUserToForm(user)
                                                            setDeleteError(null)
                                                            setForceDelete(false)
                                                            setIsDeleteOpen(true)
                                                        }}
                                                        disabled={user.id === currentUserId}
                                                        title={
                                                            user.id === currentUserId
                                                                ? "Không thể xóa tài khoản đang đăng nhập"
                                                                : "Xóa tài khoản"
                                                        }
                                                        className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#2d1515] hover:text-[#ff8e8e] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#9ba9ba]"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Edit User Panel */}
                <div className="lg:col-span-4">
                    <div className="sticky top-24 rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h2 className="text-base font-bold text-white border-b border-[#1f2c3d] pb-4">
                            Chỉnh sửa tài khoản
                        </h2>

                        {!selectedId ? (
                            <p className="mt-5 text-xs text-[#9ba9ba]">
                                Chọn một tài khoản trong bảng để xem và chỉnh sửa.
                            </p>
                        ) : (
                            <form onSubmit={handleSaveUser} className="mt-5 space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="u-name">Họ và tên *</Label>
                                    <Input
                                        id="u-name"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="u-email">Email *</Label>
                                    <Input
                                        id="u-email"
                                        type="email"
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="u-phone">Số điện thoại</Label>
                                    <Input
                                        id="u-phone"
                                        value={formPhone}
                                        onChange={(e) => setFormPhone(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Vai trò hệ thống</Label>
                                    <div className="space-y-2 text-xs">
                                        {([
                                            { key: "customer", label: "Khách hàng" },
                                            { key: "manager", label: "Quản lý rạp (Quản lý nghiệp vụ)" },
                                            { key: "admin", label: "Quản trị viên (Toàn quyền hệ thống)" },
                                        ] as { key: AdminRole; label: string }[]).map((r) => (
                                            <label
                                                key={r.key}
                                                onClick={() => setFormRole(r.key)}
                                                className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${formRole === r.key
                                                    ? "border-[#caef6b] bg-[#162518] text-white"
                                                    : "border-[#243041] bg-[#1a2431] text-[#9ba9ba] hover:text-white"
                                                    }`}
                                            >
                                                <span>{r.label}</span>
                                                <div
                                                    className={`size-3.5 rounded-full border flex items-center justify-center ${formRole === r.key ? "border-[#caef6b] bg-[#caef6b]" : "border-[#3b4c63]"
                                                        }`}
                                                >
                                                    {formRole === r.key && <div className="size-1.5 rounded-full bg-[#090d14]" />}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="u-status">Trạng thái tài khoản</Label>
                                    <select
                                        id="u-status"
                                        value={formStatus}
                                        onChange={(e) => setFormStatus(e.target.value as AdminStatus)}
                                        className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] focus:border-[#caef6b] focus:outline-none"
                                    >
                                        <option value="active">Hoạt động</option>
                                        <option value="locked">Tạm khóa tài khoản</option>
                                        <option value="unverified">Chưa xác minh</option>
                                    </select>
                                </div>

                                {notice && (
                                    <p className="rounded-xl border border-[#2a3c25] bg-[#121f15] px-3 py-2 text-[11px] font-semibold text-[#caef6b]">
                                        {notice}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="mt-4 w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
                                >
                                    {isSaving ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="size-4 animate-spin" />
                                            Đang lưu...
                                        </span>
                                    ) : (
                                        "Lưu thay đổi"
                                    )}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal xác nhận xóa tài khoản */}
            {isDeleteOpen && selectedUser && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Xác nhận xóa tài khoản"
                    onClick={() => {
                        if (!isDeleting) setIsDeleteOpen(false)
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-3xl border border-[#682424] bg-[#0b1310] p-5 shadow-2xl sm:p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-[#1f2c3d] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-[#2d1515] text-[#ff8e8e]">
                                    <AlertTriangle className="size-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Xóa tài khoản?</h2>
                                    <p className="text-[11px] text-[#9ba9ba]">Hành động này không thể hoàn tác.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDeleteOpen(false)}
                                disabled={isDeleting}
                                aria-label="Đóng"
                                className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#16202c] hover:text-white disabled:opacity-40"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[#243041] bg-[#121923] p-4">
                            <div className="text-sm font-bold text-white">{selectedUser.name}</div>
                            <div className="mt-1 text-[11px] text-[#9ba9ba]">{selectedUser.email}</div>
                            <div className="mt-2 text-[11px] text-[#d3dce7]">
                                Vai trò: <b>{ROLE_LABEL[selectedUser.role]}</b> · Trạng thái:{" "}
                                <b>{STATUS_LABEL[selectedUser.status]}</b> · Đơn đặt vé:{" "}
                                <b>{selectedUser.booking_count}</b>
                            </div>
                        </div>

                        {selectedUser.booking_count > 0 ? (
                            <div className="mt-3 space-y-2 rounded-xl border border-[#682424] bg-[#2d1515] p-3">
                                <p className="text-[11px] leading-relaxed text-[#ffb4b4]">
                                    Tài khoản này có <b>{selectedUser.booking_count} đơn đặt vé</b>. Xóa tài
                                    khoản sẽ xóa luôn các đơn này cùng ghế đã đặt và không thể khôi phục.
                                </p>
                                <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#ffd0d0]">
                                    <input
                                        type="checkbox"
                                        checked={forceDelete}
                                        onChange={(event) => setForceDelete(event.target.checked)}
                                        className="mt-0.5 size-3.5 accent-[#ff8e8e]"
                                    />
                                    <span>
                                        Tôi hiểu và muốn xóa cả {selectedUser.booking_count} đơn đặt vé
                                    </span>
                                </label>
                            </div>
                        ) : (
                            <p className="mt-3 text-[11px] leading-relaxed text-[#9ba9ba]">
                                Tài khoản chưa có đơn đặt vé nào. Nếu chỉ muốn ngừng truy cập, hãy chuyển
                                sang trạng thái <b>Tạm khóa</b> thay vì xóa.
                            </p>
                        )}

                        {deleteError && (
                            <div className="mt-3 rounded-xl border border-[#682424] bg-[#2d1515] px-3 py-2.5 text-[11px] text-[#ffb4b4]">
                                {deleteError}
                            </div>
                        )}

                        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#1f2c3d] pt-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setIsDeleteOpen(false)}
                                disabled={isDeleting}
                                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white disabled:opacity-40"
                            >
                                Hủy
                            </button>
                            <Button
                                onClick={() => void handleDeleteUser()}
                                disabled={isDeleting || (selectedUser.booking_count > 0 && !forceDelete)}
                                className="h-10 rounded-xl bg-[#d9534f] px-5 text-xs font-bold text-white hover:bg-[#c9302c] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isDeleting ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="size-4 animate-spin" />
                                        Đang xóa...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Trash2 className="size-4" />
                                        Xóa vĩnh viễn
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Bottom Section: Permissions Scopes */}
            <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                <h3 className="text-base font-bold text-white mb-4">Phạm vi quyền truy cập</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                    <div className="rounded-2xl border border-[#243041] bg-[#0e141d] p-4 space-y-1.5">
                        <span className="font-bold text-white">Khách hàng ({stats.customer})</span>
                        <p className="text-[11px] text-[#9ba9ba] leading-relaxed">
                            Đặt vé trực tuyến, quản lý lịch sử xem phim, lưu yêu thích, nhận gợi ý AI và quản lý thông tin cá nhân.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-[#2a3c25] bg-[#121f15] p-4 space-y-1.5">
                        <span className="font-bold text-[#caef6b]">Quản trị viên ({stats.admin})</span>
                        <p className="text-[11px] text-[#9ba9ba] leading-relaxed">
                            Toàn quyền cấu hình phim, lên lịch suất chiếu, điều chỉnh bảng giá vé, quản lý tài khoản và quản trị hệ thống.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
