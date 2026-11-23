import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSession } from "./lib/session";
import { ScopeProvider } from "./lib/scope";
import { isCampusAdmin, isLeader, type Role } from "./lib/types";
import { Loading } from "./components/ui";
import Shell from "./components/Shell";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AcceptInvite from "./pages/auth/AcceptInvite";
import Setup from "./pages/auth/Setup";
import NoAccess from "./pages/auth/NoAccess";
import Today from "./pages/maker/Today";
import SoulsList from "./pages/common/SoulsList";
import SoulDetail from "./pages/common/SoulDetail";
import NewSoul from "./pages/common/NewSoul";
import Sunday from "./pages/common/Sunday";
import SundayFigures from "./pages/common/Report";
import Reports from "./pages/common/Reports";
import Notifications from "./pages/common/Notifications";
import Profile from "./pages/common/Profile";
import More from "./pages/common/More";
import FamilyHome from "./pages/shepherd/FamilyHome";
import ToAssign from "./pages/shepherd/ToAssign";
import Team from "./pages/common/Team";
import Schedule from "./pages/common/Schedule";
import Church from "./pages/admin/Church";
import Families from "./pages/admin/Families";
import Settings from "./pages/admin/Settings";
import Campuses from "./pages/admin/Campuses";
import Archives from "./pages/common/Archives";
import FamilyDetail from "./pages/admin/FamilyDetail";

const HOME: Record<Role, string> = { maker: "/aujourdhui", shepherd: "/famille", assistant: "/famille", admin: "/eglise", master: "/campus" };

export default function App() {
  const { ready, user, profile, superAdminOk } = useSession();
  const loc = useLocation();
  if (!ready) return <Loading />;

  if (!user) {
    return (
      <Routes>
        <Route path="/connexion" element={<Login />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/invitation/:id" element={<AcceptInvite />} />
        <Route path="/installation" element={<Setup />} />
        <Route path="*" element={<Navigate to="/connexion" replace state={{ from: loc.pathname }} />} />
      </Routes>
    );
  }
  if (!profile || !profile.active || !superAdminOk) {
    return (
      <Routes>
        <Route path="/invitation/:id" element={<AcceptInvite />} />
        <Route path="/installation" element={<Setup />} />
        <Route path="*" element={<NoAccess />} />
      </Routes>
    );
  }

  const role = profile.role;
  const admin = isCampusAdmin(role), leader = isLeader(role);
  const home = HOME[role];
  return (
    <ScopeProvider>
      <Shell>
        <Routes>
          {["/", "/connexion", "/installation", "/invitation/:id"].map(p => <Route key={p} path={p} element={<Navigate to={home} replace />} />)}
          <Route path="/ames" element={<SoulsList />} />
          <Route path="/ames/nouvelle" element={<NewSoul />} />
          <Route path="/ames/:id" element={<SoulDetail />} />
          <Route path="/dimanche" element={<Sunday />} />
          <Route path="/rapports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/plus" element={<More />} />
          {role === "maker" && <Route path="/aujourdhui" element={<Today />} />}
          {(leader || admin) && <Route path="/a-attribuer" element={<ToAssign />} />}
          {(leader || admin) && <Route path="/programme" element={<Schedule />} />}
          {(leader || admin) && <Route path="/archives" element={<Archives />} />}
          {(leader || admin) && <Route path="/rapport-dimanche" element={<SundayFigures />} />}
          {(role === "shepherd" || admin) && <Route path="/equipe" element={<Team />} />}
          {leader && <Route path="/famille" element={<FamilyHome />} />}
          {admin && <Route path="/eglise" element={<Church />} />}
          {admin && <Route path="/familles" element={<Families />} />}
          {admin && <Route path="/familles/:id" element={<FamilyDetail />} />}
          {admin && <Route path="/reglages" element={<Settings />} />}
          {role === "master" && <Route path="/campus" element={<Campuses />} />}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Shell>
    </ScopeProvider>
  );
}
