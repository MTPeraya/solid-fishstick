"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../hooks/useAuth";

type Employee = {
  uid: string;
  name: string;
  email: string;
  role: "manager" | "cashier";
};

export default function ManagerEmployeePage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<"all" | "manager" | "cashier">("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // ยังไม่ได้ login
    if (!token) {
      setEmployees([]);
      setErr("Sign in as a manager to view employees");
      return;
    }

    // login แล้วแต่ไม่ใช่ manager
    if (user && user.role !== "manager") {
      setEmployees([]);
      setErr("Only managers can view employees");
      return;
    }

    let cancelled = false;

    const fetchEmployees = async () => {
      setLoading(true);
      setErr(null);
      try {
        const roleQuery = filter === "all" ? "" : `?role=${filter}`;

        // 🔴 ตรงนี้คือของสำคัญ: ส่ง Bearer token ไปด้วย
        const data = await api.get(`/api/users/employees${roleQuery}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) return;

        const list = (data as Employee[]).slice();

        // ให้ manager ขึ้นก่อน cashier
        list.sort((a, b) => {
          if (a.role === "manager" && b.role !== "manager") return -1;
          if (b.role === "manager" && a.role !== "manager") return 1;
          return 0;
        });

        setEmployees(list);
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setEmployees([]);
          setErr(e?.message || "Unable to load employees");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEmployees();

    return () => {
      cancelled = true;
    };
  }, [token, user, filter]);

  return (
    <main className="px-10 py-6 text-slate-900">
      <h1 className="text-xl font-semibold mb-4">Employee</h1>

      {/* filter + error */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex gap-2 mb-3">
          {(["all", "manager", "cashier"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition
                ${
                  filter === f
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
            >
              {f === "all" ? "ALL" : f.toUpperCase()}
            </button>
          ))}
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}
        {!err && (
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading employees..."
              : employees.length === 0
              ? "No employees found"
              : `Total ${employees.length} employee${employees.length > 1 ? "s" : ""}`}
          </p>
        )}
      </section>

      {/* list employees */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : !err && employees.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {employees.map((emp) => (
            <div
              key={emp.uid}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between"
            >
              <div>
                <p className="font-semibold text-sm mb-0.5">{emp.name}</p>
                <p className="text-xs text-slate-500 mb-3">{emp.email}</p>
              </div>

              <span
                className={`text-[10px] px-2 py-0.5 rounded-full tracking-wide font-semibold
                  ${
                    emp.role === "manager"
                      ? "bg-emerald-600 text-white"
                      : "bg-sky-600 text-white"
                  }`}
              >
                {emp.role.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
