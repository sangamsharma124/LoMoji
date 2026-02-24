import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProjectsDashboard.css';

const ProjectsDashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    // Get user email from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserEmail(user.email);
        loadProjects(user.email);
      } catch (e) {
        console.error('Error parsing user:', e);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadProjects = async (email) => {
    try {
      const response = await fetch(`http://localhost:3001/api/canvas/projects/${email}`);
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects || []);
      } else {
        console.error('Error loading projects:', data.error);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewProject = () => {
    const projectId = `project_${Date.now()}`;
    navigate(`/animation-tool/${projectId}`);
  };

  const openProject = (projectId) => {
    navigate(`/animation-tool/${projectId}`);
  };

  const deleteProject = async (projectId, projectName) => {
    if (!window.confirm(`Are you sure you want to delete "${projectName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/canvas/project/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProjects(prev => prev.filter(p => p.projectId !== projectId));
        alert('Project deleted successfully');
      } else {
        const data = await response.json();
        alert(`Error deleting project: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(`Error deleting project: ${error.message}`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="projects-dashboard">
        <div className="loading">Loading your projects...</div>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="projects-dashboard">
        <div className="no-user">
          <h2>Please login to view your projects</h2>
          <button className="btn-primary" onClick={() => navigate('/login')}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-dashboard">
      <div className="dashboard-header">
        <h1>My Animation Projects</h1>
        <button className="btn-primary" onClick={createNewProject}>
          + New Project
        </button>
      </div>

      <div className="projects-grid">
        {projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet. Create your first animation project!</p>
            <button className="btn-primary" onClick={createNewProject}>
              Create New Project
            </button>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.projectId} className="project-card">
              <div className="project-thumbnail" onClick={() => openProject(project.projectId)}>
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt={project.projectName} />
                ) : (
                  <div className="placeholder-thumbnail">
                    <span>🎬</span>
                  </div>
                )}
              </div>
              <div className="project-info">
                <h3 className="project-name" onClick={() => openProject(project.projectId)}>
                  {project.projectName}
                </h3>
                <p className="project-meta">
                  Last modified: {formatDate(project.lastModified)}
                </p>
                <p className="project-details">
                  {project.elements?.length || 0} elements • {project.duration}s • {project.fps} FPS
                </p>
              </div>
              <div className="project-actions">
                <button
                  className="btn-secondary"
                  onClick={() => openProject(project.projectId)}
                >
                  Open
                </button>
                <button
                  className="btn-danger"
                  onClick={() => deleteProject(project.projectId, project.projectName)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectsDashboard;
