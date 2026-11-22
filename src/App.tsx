import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSession } from "./lib/session";
import { ScopeProvider } from "./lib/scope";
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
import Report from "./pages/common/Report";
import Profile from "./pages/common/Profile";
import FamilyHome from "./pages/shepherd/FamilyHome";
import ToAssign from "./pages/shepherd/ToAssign";
import Team from "./pages/common/Team";
import Church from "./pages/admin/Church";
import Families from "./pages/admin/Families";
import Settings from "./pages/admin/Settings";
import Archives from "./pages/common/Archives";

const HOME = { maker: "/aujourdhui", shepherd: "/famille", admin: "/eglise" } as const;

export default function App() {
  const { ready, user, profile } = useSession();
  const loc = useLocation();

  if (!ready) return <Loading />;

  const publicRoutes = (
    <>
      <Route path="/connexion" element={<Login />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/invitation/:id" element={<AcceptInvite />} />
      <Route path="/installation" element={<Setup />} />
    </>
  );

  if (!user) {
    return (
      <Routes>
        {publicRoutes}
        <Route path="*" element={<Navigate to="/connexion" replace state={{ from: loc.pathname }} />} />
      </Routes>
    );
  }
  if (!profile || !profile.active) {
    return (
      <Routes>
        <Route path="/invitation/:id" element={<AcceptInvite />} />
        <Route path="/installation" element={<Setup />} />
        <Route path="*" element={<NoAccess />} />
      </Routes>
    );
  }

  const role = profile.role;
  return (
    <ScopeProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to={HOME[role]} replace />} />
          <Route path="/connexion" element={<Navigate to={HOME[role]} replace />} />
          <Route path="/invitation/:id" element={<Navigate to={HOME[role]} replace />} />
          <Route path="/installation" element={<Navigate to={HOME[role]} replace />} />
          <Route path="/aujourdhui" element={<Today />} />
          <Route path="/ames" element={<SoulsList />} />
          <Route path="/ames/nouvelle" element={<NewSoul />} />
          <Route path="/ames/:id" element={<SoulDetail />} />
          <Route path="/dimanche" element={<Sunday />} />
          <Route path="/rapport" element={<Report />} />
          <Route path="/profil" element={<Profile />} />
          {role !== "maker" && <Route path="/equipe" element={<Team />} />}
          {role !== "maker" && <Route path="/archives" element={<Archives />} />}
          {role === "shepherd" && <Route path="/famille" element={<FamilyHome />} />}
          {role !== "maker" && <Route path="/a-affecter" element={<ToAssign />} />}
          {role === "admin" && <Route path="/eglise" element={<Church />} />}
          {role === "admin" && <Route path="/familles" element={<Families />} />}
          {role === "admin" && <Route path="/reglages" element={<Settings />} />}
          <Route path="*" element={<Navigate to={HOME[role]} replace />} />
        </Routes>
      </Shell>
    </ScopeProvider>
  );
}
