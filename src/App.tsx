import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ProjectsPage } from "./components/projects/ProjectsPage";
import { ProjectDashboard } from "./components/projects/ProjectDashboard";
import { ProjectSetup } from "./components/projects/ProjectSetup";
import { ProjectSettings } from "./components/projects/ProjectSettings";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { PostComposer } from "./components/composer/PostComposer";
import { TemplatesPage } from "./components/templates/TemplatesPage";
import { ExportPage } from "./components/export/ExportPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="projects/new" element={<ProjectSetup />} />
          <Route path="projects/:projectId" element={<ProjectDashboard />} />
          <Route
            path="projects/:projectId/settings"
            element={<ProjectSettings />}
          />
          <Route path="projects/:projectId/media" element={<MediaLibrary />} />
          <Route
            path="projects/:projectId/compose"
            element={<PostComposer />}
          />
          <Route
            path="projects/:projectId/compose/:postId"
            element={<PostComposer />}
          />
          <Route
            path="projects/:projectId/templates"
            element={<TemplatesPage />}
          />
          <Route path="projects/:projectId/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
