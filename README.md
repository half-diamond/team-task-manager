# Team Task Manager

A full-stack team task manager built with **Node.js, Express, MongoDB, HTML, CSS, and vanilla JavaScript**.

## Features
- Signup and login with JWT auth
- Create projects and manage members by role
- Create tasks with due date, priority, and assignee
- Update task status: To Do, In Progress, Done
- Project dashboard with totals, status breakdown, tasks per user, and overdue tasks
- Admin-only controls for adding/removing members, assigning tasks, and deleting tasks

## Tech Stack
- Backend: Express, MongoDB, Mongoose, JWT
- Frontend: Plain HTML, CSS, JavaScript
- Deployment: Railway-ready

## Local Setup
1. Install dependencies from the project root:
   ```bash
   npm install
   ```
2. Create environment files:
   - `backend/.env` from `backend/.env.example`
3. Add your MongoDB connection string and JWT secret.
4. Start the app:
   ```bash
   npm start
   ```
5. Open the app in your browser using the Railway URL or local server URL.

## Environment Variables
### backend/.env
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
NODE_ENV=development
CLIENT_URL=http://localhost:5000
```

## Deployment on Railway
1. Push the repository to GitHub.
2. Create a new Railway project from the repo.
3. Add the environment variables above in Railway.
4. Set the start command to:
   ```bash
   npm start
   ```
5. Deploy the service and open the public Railway URL.

## API Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/members`
- `DELETE /api/projects/:id/members/:userId`
- `GET /api/tasks/project/:projectId`
- `POST /api/tasks/project/:projectId`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/assign`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard/project/:projectId`
