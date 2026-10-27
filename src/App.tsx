import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SessionProvider, useSession } from '@/lib/session';
import { AppShell } from '@/components/Shell';
import { LoadingState } from '@/components/ui';
const Landing = lazy(() => import('@/pages/Landing'));
const Sectors = lazy(() => import('@/pages/Sectors'));
const Login = lazy(() => import('@/pages/Login'));
const WorkerHome = lazy(() => import('@/pages/WorkerHome'));
const Shifts = lazy(() => import('@/pages/Shifts'));
const Pay = lazy(() => import('@/pages/Pay'));
const Safety = lazy(() => import('@/pages/Safety'));
const Me = lazy(() => import('@/pages/Me'));
const Wellbeing = lazy(() => import('@/pages/Wellbeing'));
const Feedback = lazy(() => import('@/pages/Feedback'));
const Skills = lazy(() => import('@/pages/Skills'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminSafety = lazy(() => import('@/pages/AdminSafety'));
const AdminFeedback = lazy(() => import('@/pages/AdminFeedback'));
const AdminSkills = lazy(() => import('@/pages/AdminSkills'));
const AdminPeople = lazy(() => import('@/pages/AdminPeople'));
const Passport = lazy(() => import('@/pages/Passport'));

function Guard({ role, children }: { role: 'worker' | 'admin'; children: React.ReactNode }) {
  const { user, ready } = useSession(); const location = useLocation();
  if (!ready) return <LoadingState/>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace/>;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/worker'} replace/>;
  return <AppShell>{children}</AppShell>;
}
function AppRoutes() {
  return <Suspense fallback={<LoadingState/>}><Routes>
    <Route path="/" element={<Landing/>}/><Route path="/sectors" element={<Sectors/>}/><Route path="/login" element={<Login/>}/><Route path="/passport/:token" element={<Passport/>}/>
    <Route path="/worker" element={<Guard role="worker"><WorkerHome/></Guard>}/>
    <Route path="/worker/shifts" element={<Guard role="worker"><Shifts/></Guard>}/><Route path="/worker/pay" element={<Guard role="worker"><Pay/></Guard>}/>
    <Route path="/worker/safety" element={<Guard role="worker"><Safety/></Guard>}/><Route path="/worker/me" element={<Guard role="worker"><Me/></Guard>}/>
    <Route path="/worker/wellbeing" element={<Guard role="worker"><Wellbeing/></Guard>}/><Route path="/worker/feedback" element={<Guard role="worker"><Feedback/></Guard>}/><Route path="/worker/skills" element={<Guard role="worker"><Skills/></Guard>}/>
    <Route path="/admin" element={<Guard role="admin"><AdminDashboard/></Guard>}/><Route path="/admin/safety" element={<Guard role="admin"><AdminSafety/></Guard>}/>
    <Route path="/admin/feedback" element={<Guard role="admin"><AdminFeedback/></Guard>}/><Route path="/admin/skills" element={<Guard role="admin"><AdminSkills/></Guard>}/><Route path="/admin/people" element={<Guard role="admin"><AdminPeople/></Guard>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense>;
}
export default function App() {
  return <SessionProvider><BrowserRouter><AppRoutes/><Toaster position="top-center" toastOptions={{ duration: 3200 }}/></BrowserRouter></SessionProvider>;
}
