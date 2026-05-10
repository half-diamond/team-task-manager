const Task = require('../models/Task');
const Project = require('../models/Project');

const idOf = (doc) => doc?._id || doc;

const sameId = (left, right) => {
  const leftId = idOf(left);
  const rightId = idOf(right);
  return Boolean(leftId && rightId && leftId.toString() === rightId.toString());
};

const memberId = (member) => idOf(member.user);

const hasProjectAccess = (project, userId) =>
  project.members.some((member) => sameId(memberId(member), userId));

const isProjectAdmin = (project, userId) =>
  project.members.some((member) => sameId(memberId(member), userId) && member.role === 'Admin');

exports.projectOverview = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('members.user', 'name email');
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!hasProjectAccess(project, req.user._id)) {
      res.status(403);
      throw new Error('Not allowed');
    }

    const admin = isProjectAdmin(project, req.user._id);
    const taskQuery = { project: project._id };
    if (!admin) {
      taskQuery.assignedTo = req.user._id;
    }

    const tasks = await Task.find(taskQuery).populate('assignedTo', 'name email');

    const totalTasks = tasks.length;
    const byStatus = {
      'To Do': tasks.filter((t) => t.status === 'To Do').length,
      'In Progress': tasks.filter((t) => t.status === 'In Progress').length,
      Done: tasks.filter((t) => t.status === 'Done').length
    };

    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.status !== 'Done' && new Date(t.dueDate) < new Date()
    ).length;

    const workloadMembers = (admin
      ? project.members
      : project.members.filter((member) => {
          return sameId(memberId(member), req.user._id);
        })).filter((member) => memberId(member));

    const tasksPerUser = workloadMembers.map((member) => {
      const id = memberId(member);
      return {
        user: member.user,
        role: member.role,
        count: tasks.filter((task) => sameId(task.assignedTo, id)).length
      };
    });

    res.json({
      project: {
        id: project._id,
        name: project.name,
        description: project.description
      },
      stats: {
        scope: admin ? 'project' : 'assigned',
        totalTasks,
        byStatus,
        tasksPerUser,
        overdueTasks
      }
    });
  } catch (error) {
    next(error);
  }
};
