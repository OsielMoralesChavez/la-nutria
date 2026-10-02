import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth, RequirePermission } from '../features/auth/guards.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { ForcedPasswordChangePage } from '../features/auth/ChangePasswordForm.jsx';
import { NotFoundPage } from '../features/errors/ErrorPages.jsx';
import { AppLayout } from '../layouts/AppLayout.jsx';

// Carga diferida por sección: el primer acceso descarga sólo lo necesario.
const AgendaPage = lazy(() => import('../features/agenda/AgendaPage.jsx').then((m) => ({ default: m.AgendaPage })));
const ConsultationMode = lazy(() => import('../features/consultations/ConsultationMode.jsx').then((m) => ({ default: m.ConsultationMode })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage.jsx').then((m) => ({ default: m.DashboardPage })));
const AlertsPage = lazy(() => import('../features/followup/AlertsPage.jsx').then((m) => ({ default: m.AlertsPage })));
const FollowUpPage = lazy(() => import('../features/followup/FollowUpPage.jsx').then((m) => ({ default: m.FollowUpPage })));
const ConsultationDetail = lazy(() => import('../features/patients/pages/ConsultationDetail.jsx').then((m) => ({ default: m.ConsultationDetail })));
const PatientInterventions = lazy(() => import('../features/patients/pages/PatientInterventions.jsx').then((m) => ({ default: m.PatientInterventions })));
const PatientLayout = lazy(() => import('../features/patients/pages/PatientLayout.jsx').then((m) => ({ default: m.PatientLayout })));
const PatientNext = lazy(() => import('../features/patients/pages/PatientNext.jsx').then((m) => ({ default: m.PatientNext })));
const PatientProgress = lazy(() => import('../features/patients/pages/PatientProgress.jsx').then((m) => ({ default: m.PatientProgress })));
const PatientStart = lazy(() => import('../features/patients/pages/PatientStart.jsx').then((m) => ({ default: m.PatientStart })));
const PatientSummary = lazy(() => import('../features/patients/pages/PatientSummary.jsx').then((m) => ({ default: m.PatientSummary })));
const PatientsPage = lazy(() => import('../features/patients/pages/PatientsPage.jsx').then((m) => ({ default: m.PatientsPage })));
const SettingsLayout = lazy(() => import('../features/settings/SettingsLayout.jsx').then((m) => ({ default: m.SettingsLayout })));
const AlertRulesSettings = lazy(() => import('../features/settings/sections/AlertRulesSettings.jsx').then((m) => ({ default: m.AlertRulesSettings })));
const AuditSettings = lazy(() => import('../features/settings/sections/AuditSettings.jsx').then((m) => ({ default: m.AuditSettings })));
const CatalogsSettings = lazy(() => import('../features/settings/sections/CatalogsSettings.jsx').then((m) => ({ default: m.CatalogsSettings })));
const ClinicSettings = lazy(() => import('../features/settings/sections/ClinicSettings.jsx').then((m) => ({ default: m.ClinicSettings })));
const ProfileSettings = lazy(() => import('../features/settings/sections/ProfileSettings.jsx').then((m) => ({ default: m.ProfileSettings })));
const SecuritySettings = lazy(() => import('../features/settings/sections/SecuritySettings.jsx').then((m) => ({ default: m.SecuritySettings })));
const RolesPage = lazy(() => import('../features/users/RolesPage.jsx').then((m) => ({ default: m.RolesPage })));
const UsersPage = lazy(() => import('../features/users/UsersPage.jsx').then((m) => ({ default: m.UsersPage })));

/**
 * Rutas. Cada sección declara el permiso que exige (RequirePermission);
 * la API vuelve a validar cada petición.
 */
const guard = (permission, element) => <RequirePermission permission={permission}>{element}</RequirePermission>;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/cambiar-contrasena', element: <ForcedPasswordChangePage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: guard('dashboard:read', <DashboardPage />) },
          { path: 'agenda', element: guard('appointments:read', <AgendaPage />) },
          { path: 'pacientes', element: guard('patients:read', <PatientsPage />) },
          { path: 'pacientes/:id/consulta/:cid', element: guard('consultations:update', <ConsultationMode />) },
          {
            path: 'pacientes/:id',
            element: guard('patients:read', <PatientLayout />),
            children: [
              { index: true, element: <PatientSummary /> },
              { path: 'inicio', element: <PatientStart /> },
              { path: 'intervenciones', element: <PatientInterventions /> },
              { path: 'intervenciones/consultas/:cid', element: <ConsultationDetail /> },
              { path: 'evolucion', element: <PatientProgress /> },
              { path: 'siguiente', element: <PatientNext /> },
            ],
          },
          { path: 'seguimiento', element: guard('followups:read', <FollowUpPage />) },
          { path: 'seguimiento/alertas', element: guard('alerts:read', <AlertsPage />) },
          { path: 'usuarios', element: guard('users:read', <UsersPage />) },
          { path: 'usuarios/roles', element: guard('roles:read', <RolesPage />) },
          {
            path: 'configuracion',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="perfil" replace /> },
              { path: 'perfil', element: <ProfileSettings /> },
              { path: 'seguridad', element: <SecuritySettings /> },
              { path: 'consultorio', element: guard('settings:manage', <ClinicSettings />) },
              { path: 'catalogos', element: guard('catalogs:manage', <CatalogsSettings />) },
              { path: 'alertas', element: guard('alerts:manage', <AlertRulesSettings />) },
              { path: 'auditoria', element: guard('audit:read', <AuditSettings />) },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  ],
  // En GitHub Pages la app vive bajo /la-nutria/; en local, en la raíz.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
