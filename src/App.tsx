import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ProjectsPage } from "./components/projects/ProjectsPage";
import { ProjectDashboard } from "./components/projects/ProjectDashboard";
import { ProjectSetup } from "./components/projects/ProjectSetup";
import { ProjectSettings } from "./components/projects/ProjectSettings";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { PostComposer } from "./components/composer/PostComposer";
import { ExportPage } from "./components/export/ExportPage";

function App() {
  const [buildStale, setBuildStale] = useState(false);

  useEffect(() => {
    void fetch("/api/build-status")
      .then((r) => r.json())
      .then((d) => setBuildStale(d.stale === true))
      .catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      {buildStale && (
        <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
          Source files have changed since the last build. Run{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            npm run restart:pm2
          </code>{" "}
          to apply updates.
        </div>
      )}
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
          <Route path="projects/:projectId/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
