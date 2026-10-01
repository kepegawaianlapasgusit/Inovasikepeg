import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ChangePassword from "@/pages/ChangePassword";
import Employees from "@/pages/Employees";
import EmployeeDetail from "@/pages/EmployeeDetail";
import Attendance from "@/pages/Attendance";
import AttendanceDetail from "@/pages/AttendanceDetail";
import Users from "@/pages/Users";
import MasterData from "@/pages/MasterData";
import AuditLog from "@/pages/AuditLog";
import Kgb from "@/pages/Kgb";
import Promotion from "@/pages/Promotion";
import Announcements from "@/pages/Announcements";
import Notifications from "@/pages/Notifications";
import Calendar from "@/pages/Calendar";
import Evaluation from "@/pages/Evaluation";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Documents from "@/pages/Documents";
import Leave from "@/pages/Leave";
import Training from "@/pages/Training";
import Awards from "@/pages/Awards";
import Discipline from "@/pages/Discipline";

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="attendance/:id" element={<AttendanceDetail />} />
            <Route path="kgb" element={<Kgb />} />
            <Route path="promotion" element={<Promotion />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="evaluation" element={<Evaluation />} />
            <Route path="documents" element={<Documents />} />
            <Route path="leave" element={<Leave />} />
            <Route path="training" element={<Training />} />
            <Route path="awards" element={<Awards />} />
            <Route path="discipline" element={<Discipline />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="master" element={<MasterData />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
