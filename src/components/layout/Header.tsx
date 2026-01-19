import { Link, useLocation, useParams } from "react-router-dom";
import { useProject } from "../../hooks/useProjects";

export function Header() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">
                Social Content
              </span>
            </Link>

            {project && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-600">{project.name}</span>
              </>
            )}
          </div>

          {project && (
            <nav className="flex items-center gap-1">
              <NavLink to={`/projects/${projectId}`} end>
                Dashboard
              </NavLink>
              <NavLink to={`/projects/${projectId}/media`}>Media</NavLink>
              <NavLink to={`/projects/${projectId}/compose`}>Compose</NavLink>
              <NavLink to={`/projects/${projectId}/export`}>Export</NavLink>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  to,
  children,
  end,
}: {
  to: string;
  children: React.ReactNode;
  end?: boolean;
}) {
  const location = useLocation();
  const isActive = end
    ? location.pathname === to
    : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary-50 text-primary-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}
